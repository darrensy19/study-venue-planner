import { rankVenues, CONTROL_CONTRACT, dateFromAbs } from "./ranking.js";

// The hours-side feasibility tolerance is owned by ranking.js, not here —
// rankVenues() defaults toleranceMinutes to its own FEASIBILITY_TOLERANCE_MINUTES
// when a controls object omits it (PLAN.md "tolerance ownership").

// Value tokens and numeric bounds come from CONTROL_CONTRACT — the single
// source shared with rankVenues()'s own validation (PLAN.md "One
// ranking-owned control contract is the single source for both the form and
// the validator"). Only human-readable labels are renderer-owned.
const ORIGIN_LABELS = { home: "Home", office: "Office" };
const MODE_LABELS = { transit: "Transit", walk: "Walk", cycle: "Cycle" };
const ORIGINS = CONTROL_CONTRACT.origins.map((value) => ({ value, label: ORIGIN_LABELS[value] ?? value }));
const MODES = CONTROL_CONTRACT.modes.map((value) => ({ value, label: MODE_LABELS[value] ?? value }));

// A stated label vocabulary (PLAN.md's "Naming and presentation hierarchy")
// mapping seat_confidence / baseline_seatability / busyness bands / return
// bases to user-facing text — printing a raw identifier like
// "usually_available" is what happens without one. Both baseline_seatability
// and seat_confidence share one ladder (poor/mixed/usually_available/
// dependable, plus unknown), so one map covers both.
const SEATABILITY_LABELS = {
  dependable: "High",
  usually_available: "Good",
  mixed: "Medium",
  poor: "Low",
  unknown: "Unknown",
};

const BUSYNESS_LABELS = {
  quiet: "Quieter than usual for this venue",
  typical: "Typical for this venue",
  busy: "Busier than usual for this venue",
  peak: "As busy as it gets for this venue",
  unknown: "Unknown (lower evidence)",
};

const RETURN_BASIS_LABEL = {
  schedule_free: "an admissible walk/cycle route",
  core_span: "the daytime core service span",
  last_departure: "the timetable",
  no_recorded_route: "no recorded route home",
  pre_dawn_gap: "the pre-dawn service gap",
  no_data: "no timetable data recorded",
};

const FRESHNESS_LABELS = { stale: "stale — showing last known good", failed: "unavailable" };

// --- One state object. Never read state back out of the DOM. ---------------

export const state = {
  venues: [],
  holidays: {},
  seatlog: [],
  controls: null,
  result: null,
};

// --- small pure helpers — formatting only, nothing decided here ------------

function readEmbeddedJson(id) {
  return JSON.parse(document.getElementById(id).textContent);
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesToClock(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function clockToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatClockFromAbs(abs) {
  return minutesToClock(abs);
}

function formatMinutesDisplay(minutes) {
  if (minutes == null) return "unknown";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

// PLAN.md's "Naming and presentation hierarchy": "Every displayed instant
// that can cross midnight carries a day marker... stringifying before
// returning destroys the day relationship." `referenceDate` is the request's
// own departure date — the one calendar anchor every rendered instant in a
// given render pass is judged against.
function formatInstant(abs, referenceDate) {
  const clock = formatClockFromAbs(abs);
  const date = dateFromAbs(abs);
  return date === referenceDate ? clock : `${clock} (${date})`;
}

function formatBindingLimit(bindingLimitMid, referenceDate) {
  if (bindingLimitMid === undefined) return "not open at this arrival";
  if (bindingLimitMid === "UNDETERMINED") return "no known closing constraint within the verified span";
  return formatInstant(bindingLimitMid, referenceDate);
}

// latest_leave_at carries an explicit state (PLAN.md's "Requested end vs
// achievable end") since the raw arithmetic reads as a typo beside a much
// later departure otherwise.
function latestLeaveClause(candidate, referenceDate) {
  switch (candidate.latestLeaveAtState) {
    case "future":
      return formatInstant(candidate.latestLeaveAt, referenceDate);
    case "past":
      return `${formatInstant(candidate.latestLeaveAt, referenceDate)} — already past`;
    case "undetermined":
      return "no known closing constraint within the verified span";
    case "closed_at_arrival":
      return "not open at this arrival";
    default:
      return "unknown";
  }
}

function freshnessWarningTexts(entity) {
  const texts = [];
  if (entity.hoursStatus && entity.hoursStatus !== "ok") {
    texts.push(`Hours evidence: ${FRESHNESS_LABELS[entity.hoursStatus] ?? entity.hoursStatus}`);
  }
  if (entity.histogramStatus && entity.histogramStatus !== "ok") {
    texts.push(`Busyness evidence: ${FRESHNESS_LABELS[entity.histogramStatus] ?? entity.histogramStatus}`);
  }
  return texts;
}

function defaultControls() {
  const now = new Date();
  return {
    origin: "home",
    mode: "transit",
    raining: false,
    departureDate: todayIso(),
    leaveAtMinutes: now.getHours() * 60 + now.getMinutes(),
    durationMinutes: 240,
  };
}

function readControlsFromForm(form) {
  const data = new FormData(form);
  return {
    origin: data.get("origin"),
    mode: data.get("mode"),
    raining: data.get("raining") === "on",
    departureDate: data.get("departureDate"),
    leaveAtMinutes: clockToMinutes(data.get("leaveAt")),
    durationMinutes: Number(data.get("durationMinutes")),
  };
}

function compute() {
  state.result = rankVenues({ venues: state.venues, holidays: state.holidays }, state.controls);
}

// --- DOM helpers -------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child != null) node.appendChild(child);
  }
  return node;
}

// --- presentation: reads the pipeline's shape, re-derives none of it -------
//
// PLAN.md:1754 / 2263-2265 — every ranked row (Plan A and every "More
// alternatives" row alike) must show seat_confidence with both components,
// both feasibility tiers and the overall tier, the binding constraint and
// the return mode being counted on, usable_minutes, latest_leave_at, travel,
// backup_strength, and preference. Every value read below already exists on
// the candidate object rankVenues() returns — nothing here decides a tier,
// an ordering, or a refusal condition.

const BINDING_CONSTRAINT_LABEL = {
  venue_close: "closing time",
  last_departure: "last departure home",
  none: "no binding limit within the verified span",
};

function seatConfidenceLine(candidate) {
  const baselineText = SEATABILITY_LABELS[candidate.baselineSeatability] ?? candidate.baselineSeatability;
  const adjustmentText = BUSYNESS_LABELS[candidate.busynessBand.band] ?? candidate.busynessBand.band;
  const confidenceText = SEATABILITY_LABELS[candidate.seatConfidence.confidence] ?? candidate.seatConfidence.confidence;
  return `Baseline: ${baselineText} · Adjustment: ${adjustmentText} → seat confidence: ${confidenceText}`;
}

function feasibilityLine(candidate) {
  return `Hours: ${candidate.hoursTier} · Return: ${candidate.returnTier} · Overall: ${candidate.tier}`;
}

function bindingLine(candidate, referenceDate) {
  const constraintText = BINDING_CONSTRAINT_LABEL[candidate.bindingConstraint] ?? "not open at this arrival";
  const basisText = RETURN_BASIS_LABEL[candidate.returnBasis];
  const modesText = candidate.returnModes?.length ? ` via ${candidate.returnModes.join("/")}` : "";
  const returnPart = basisText ? ` — home counted on ${basisText}${modesText}` : "";
  return `Binding constraint: ${constraintText}${returnPart} · Leave the venue by: ${formatBindingLimit(candidate.bindingLimitMid, referenceDate)}`;
}

// Fixes the pre-existing defect where the requested end (sessionEndMidAbs)
// was labelled as the session's end: achievableSessionEndMid is the
// achievable end, undefined exactly when usableMinutesMid is (PLAN.md's
// "Requested end vs achievable end"). A candidate closed at arrival renders
// "closed when you'd arrive" for its usable/end portion, never
// "Usable: unknown" — but still shows its own latest-leave state and travel
// time, which remain meaningful even then.
function metricsLine(candidate, ctx) {
  const basisNote = candidate.metricsBasis === "hours_only" ? " (hours only — return unverified)" : "";
  let usableText;
  if (candidate.usableMinutesMid === undefined) {
    usableText = "closed when you'd arrive";
  } else {
    const achievable = formatMinutesDisplay(candidate.usableMinutesMid);
    const durationNote =
      candidate.usableMinutesMid < ctx.requestedDurationMinutes
        ? ` of the ${formatMinutesDisplay(ctx.requestedDurationMinutes)} you asked for`
        : "";
    const endText = formatInstant(candidate.achievableSessionEndMid, ctx.referenceDate);
    usableText = `${achievable}${durationNote} · ends ~${endText}`;
  }
  return `Usable: ${usableText}${basisNote} · latest leave: ${latestLeaveClause(candidate, ctx.referenceDate)} · ${candidate.travelMinutesMid}m travel`;
}

function rankingLine(candidate) {
  return `Backup: ${candidate.backupStrength} · Preference rank: ${candidate.preference}`;
}

function renderCandidateCard(candidate, label, ctx) {
  const card = el("article", { class: `plan-card tier-${candidate.tier}` });
  card.appendChild(el("h3", { text: label ? `${label}: ${candidate.displayName}` : candidate.displayName }));
  card.appendChild(el("p", { class: "area", text: candidate.area }));
  card.appendChild(el("p", { class: "tier", text: feasibilityLine(candidate) }));
  card.appendChild(el("p", { class: "binding", text: bindingLine(candidate, ctx.referenceDate) }));
  card.appendChild(el("p", { class: "seat-confidence", text: seatConfidenceLine(candidate) }));
  card.appendChild(el("p", { class: "metrics", text: metricsLine(candidate, ctx) }));
  card.appendChild(el("p", { class: "ranking", text: rankingLine(candidate) }));

  for (const text of freshnessWarningTexts(candidate)) {
    card.appendChild(el("p", { class: "warning freshness", text }));
  }

  if (candidate.tier === "tight") {
    const thinConstraint = BINDING_CONSTRAINT_LABEL[candidate.bindingConstraint] ?? "the binding constraint";
    card.appendChild(
      el("p", { class: "warning thin-margin", text: `Thin margin — ${thinConstraint} is close to binding.` })
    );
  }
  if (candidate.tier === "unverified") {
    card.appendChild(el("p", { class: "warning", text: "Way home not verified — never Plan A." }));
  }

  if (candidate.planB) {
    card.appendChild(renderPlanBSummary(candidate.planB, ctx));
  } else {
    card.appendChild(el("p", { class: "plan-b-summary", text: "No viable fallback if full." }));
  }
  return card;
}

// PLAN.md's "Naming and presentation hierarchy": disambiguatedLabel is used
// for inline contexts with no separate area line — Plan B is one of them.
// planB.travelMinutesMid ("the returned presentation shape") is the
// fallback's own already-parsed transfer time. A salvage option states its
// actual duration against the requested one, verbatim per CLAUDE.md's
// "Plan A / Plan B" — never presented as satisfying the request.
function renderPlanBSummary(planB, ctx) {
  const container = el("div", { class: "plan-b-summary" });
  const transferText = `${planB.travelMinutesMid}m transfer`;
  const text =
    planB.strength === "strong"
      ? `If full: ${planB.disambiguatedLabel} via ${planB.mode} — ${transferText}, full session, ${planB.overallTier}`
      : `If full: ${planB.disambiguatedLabel} via ${planB.mode} — ${transferText}, salvage: gives ${formatMinutesDisplay(planB.usableMinutesMid)}, not the ${formatMinutesDisplay(ctx.requestedDurationMinutes)} you asked for (${planB.overallTier})`;
  container.appendChild(el("p", { text }));
  for (const freshText of freshnessWarningTexts(planB)) {
    container.appendChild(el("p", { class: "warning freshness", text: freshText }));
  }
  return container;
}

function renderRemovalNotice(removal) {
  return el("li", { text: `${removal.disambiguatedLabel}: ${removal.reason}` });
}

function renderAlternatives(alternatives, ctx) {
  // Every alternative gets the same full card as Plan A (PLAN.md:1754) —
  // grouped by area, but not reduced to a thinner summary. The Plan A / Row /
  // Disclosure progressive-disclosure split is Slice 4's job, not this one's.
  const container = el("div", { class: "alternatives" });
  for (const [area, candidates] of Object.entries(alternatives)) {
    const section = el("section", { class: "area-group" });
    section.appendChild(el("h4", { text: area }));
    for (const candidate of candidates) {
      section.appendChild(renderCandidateCard(candidate, undefined, ctx));
    }
    container.appendChild(section);
  }
  return container;
}

function renderControls(controls) {
  const form = el("form", { class: "controls" });

  const dateInput = el("input", {
    type: "date",
    name: "departureDate",
    value: controls.departureDate,
    required: "required",
  });
  const leaveAtInput = el("input", {
    type: "time",
    name: "leaveAt",
    value: minutesToClock(controls.leaveAtMinutes),
    required: "required",
  });
  const durationInput = el("input", {
    type: "number",
    name: "durationMinutes",
    value: String(controls.durationMinutes),
    min: String(CONTROL_CONTRACT.duration.min),
    max: String(CONTROL_CONTRACT.duration.max),
    step: String(CONTROL_CONTRACT.duration.step),
    required: "required",
  });

  const originSelect = el("select", { name: "origin" });
  for (const { value, label } of ORIGINS) {
    const option = el("option", { value, text: label });
    if (value === controls.origin) option.selected = true;
    originSelect.appendChild(option);
  }

  const modeSelect = el("select", { name: "mode" });
  for (const { value, label } of MODES) {
    const option = el("option", { value, text: label });
    if (value === controls.mode) option.selected = true;
    modeSelect.appendChild(option);
  }

  const rainingInput = el("input", { type: "checkbox", name: "raining" });
  rainingInput.checked = controls.raining;

  form.appendChild(el("label", { text: "Date " }, [dateInput]));
  form.appendChild(el("label", { text: "Leave at " }, [leaveAtInput]));
  form.appendChild(el("label", { text: "Duration (minutes) " }, [durationInput]));
  form.appendChild(el("label", { text: "Origin " }, [originSelect]));
  form.appendChild(el("label", { text: "Travel mode " }, [modeSelect]));
  form.appendChild(el("label", { text: "Raining " }, [rainingInput]));
  form.appendChild(el("button", { type: "submit", text: "Plan my session" }));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.controls = readControlsFromForm(form);
    compute();
    render(state);
  });

  return form;
}

// --- resultState rendering — one discriminated outcome, not independent
// refusal flags (PLAN.md's "Result states"). Every branch renders its own
// distinct text; there is no default case that could silently swallow an
// unhandled state. --------------------------------------------------------

function formatPermitted(permitted) {
  if (Array.isArray(permitted)) return permitted.join(", ");
  if (permitted && typeof permitted === "object") return `${permitted.min}-${permitted.max}`;
  return String(permitted);
}

const RESULT_STATE_TEXT = {
  no_low_risk_option:
    "No low-risk option found for the requested session — somewhere fits, but nowhere is likely to seat you. Try a different time, or accept the risk.",
  session_does_not_fit:
    "Every venue closes too soon, or needs you to leave for the last way home, for the requested session. Leave earlier, or shorten the session.",
};

function renderResultState(root, result, ctx) {
  switch (result.resultState) {
    case "plan_a":
      return;
    case "invalid_request": {
      const box = el("div", { class: "refusal invalid-request" });
      box.appendChild(el("p", { text: "The request is outside the supported range." }));
      const list = el("ul");
      for (const v of result.violations) {
        list.appendChild(
          el("li", { text: `${v.control}: got ${JSON.stringify(v.supplied)}, expected ${formatPermitted(v.permitted)}` })
        );
      }
      box.appendChild(list);
      root.appendChild(box);
      return;
    }
    case "no_low_risk_option":
      root.appendChild(el("p", { class: "refusal", text: RESULT_STATE_TEXT.no_low_risk_option }));
      return;
    case "session_does_not_fit": {
      root.appendChild(el("p", { class: "refusal", text: RESULT_STATE_TEXT.session_does_not_fit }));
      if (result.bestAlternative) {
        root.appendChild(
          el("p", { class: "note", text: "Best available, shown for reference — not a recommendation:" })
        );
        root.appendChild(renderCandidateCard(result.bestAlternative, undefined, ctx));
      }
      return;
    }
    case "no_verified_return": {
      const instant = result.refusalInstant !== undefined ? formatInstant(result.refusalInstant, ctx.referenceDate) : "the requested time";
      root.appendChild(
        el("p", {
          class: "refusal",
          text: `No option with a verified way home for a session ending at ${instant}. Fill in return_transport data to resolve.`,
        })
      );
      return;
    }
    case "nothing_evaluable": {
      const box = el("div", { class: "refusal nothing-evaluable" });
      box.appendChild(el("p", { text: "Nothing could be assessed for this request." }));
      const lines = [];
      if (result.snapshotEmpty) lines.push("No venues are recorded at all.");
      if (result.hardFilteredCount > 0) lines.push(`${result.hardFilteredCount} venue(s) have no recorded route for this origin/mode.`);
      if (result.travelUnknown.length > 0) lines.push(`${result.travelUnknown.length} venue(s) have travel time not yet measured.`);
      if (result.removed.length > 0) lines.push(`${result.removed.length} venue(s) were removed — see below.`);
      const list = el("ul");
      for (const line of lines) list.appendChild(el("li", { text: line }));
      box.appendChild(list);
      root.appendChild(box);
      return;
    }
  }
}

// --- render(state): app.js renders; it decides nothing. ---------------------

export function render(state) {
  const root = document.getElementById("app");
  root.replaceChildren();
  root.appendChild(renderControls(state.controls));

  const result = state.result;
  if (!result) return;

  // referenceDate anchors every day marker in this render pass (PLAN.md's
  // "Every displayed instant that can cross midnight carries a day marker").
  // requestedDurationMinutes is the request's own input, echoed back for the
  // "of the Xh you asked for" / salvage comparisons — never re-derived.
  const ctx = { referenceDate: state.controls.departureDate, requestedDurationMinutes: state.controls.durationMinutes };

  renderResultState(root, result, ctx);

  if (result.planA) {
    root.appendChild(renderCandidateCard(result.planA, "Plan A", ctx));
  }

  if (Object.keys(result.alternatives).length > 0) {
    root.appendChild(el("h2", { text: "More alternatives" }));
    root.appendChild(renderAlternatives(result.alternatives, ctx));
  }

  if (result.travelUnknown.length) {
    const section = el("section", { class: "travel-unknown" });
    section.appendChild(el("h4", { text: "Travel time not yet measured" }));
    const list = el("ul");
    for (const entry of result.travelUnknown) {
      list.appendChild(el("li", { text: entry.disambiguatedLabel }));
    }
    section.appendChild(list);
    root.appendChild(section);
  }

  if (result.removed.length) {
    const section = el("section", { class: "removed" });
    section.appendChild(el("h4", { text: "Not shown" }));
    const list = el("ul");
    for (const removal of result.removed) list.appendChild(renderRemovalNotice(removal));
    section.appendChild(list);
    root.appendChild(section);
  }
}

// --- bootstrap ----------------------------------------------------------------

function init() {
  state.venues = readEmbeddedJson("data-venues");
  state.holidays = readEmbeddedJson("data-holidays");
  state.seatlog = readEmbeddedJson("data-seatlog");
  state.controls = defaultControls();
  compute();
  render(state);
}

// Guarded so the module is importable with no `document` at all (tests/js/
// under Node has none unless a test supplies one) — in a real page, `document`
// always exists and this behaves exactly as before.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
