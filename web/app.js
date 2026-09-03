import { rankVenues } from "./ranking.js";

// PLAN.md "Three feasibility tiers" — provisional 15 minutes. ranking.js's
// hours-side toleranceMinutes has no internal default (unlike the
// return-side tolerance and the Plan B thresholds, which do); the caller
// must supply this one explicitly.
const FEASIBILITY_TOLERANCE_MINUTES = 15;

const ORIGINS = [
  { value: "origin_a", label: "Origin A" },
  { value: "origin_b", label: "Origin B" },
];
const MODES = [
  { value: "transit", label: "Transit" },
  { value: "walk", label: "Walk" },
  { value: "cycle", label: "Cycle" },
];

// --- One state object. Never read state back out of the DOM. ---------------

const state = {
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

function displayName(venueId) {
  return venueId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function defaultControls() {
  const now = new Date();
  return {
    origin: "origin_a",
    mode: "transit",
    raining: false,
    departureDate: todayIso(),
    leaveAtMinutes: now.getHours() * 60 + now.getMinutes(),
    durationMinutes: 240,
    toleranceMinutes: FEASIBILITY_TOLERANCE_MINUTES,
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
    toleranceMinutes: FEASIBILITY_TOLERANCE_MINUTES,
  };
}

function venueById(id) {
  return state.venues.find((v) => v.id === id) ?? null;
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

const RETURN_BASIS_LABEL = {
  schedule_free: "an admissible walk/cycle route",
  core_span: "the daytime core service span",
  last_departure: "the timetable",
  no_recorded_route: "no recorded route home",
  pre_dawn_gap: "the pre-dawn service gap",
  no_data: "no timetable data recorded",
};

function seatConfidenceLine(candidate) {
  const busyness = candidate.busynessBand;
  const adjustmentText =
    busyness.band === "unknown" ? "unknown (lower evidence)" : `${busyness.band} for this venue`;
  return `Baseline: ${candidate.baselineSeatability} · Adjustment: ${adjustmentText} → seat confidence: ${candidate.seatConfidence.confidence}`;
}

function feasibilityLine(candidate) {
  return `Hours: ${candidate.hoursTier} · Return: ${candidate.returnTier} · Overall: ${candidate.tier}`;
}

function bindingLine(candidate) {
  const constraintText = BINDING_CONSTRAINT_LABEL[candidate.bindingConstraint] ?? "not open at this arrival";
  const basisText = RETURN_BASIS_LABEL[candidate.returnBasis];
  const modesText =
    candidate.returnModes && candidate.returnModes.length > 0 ? ` via ${candidate.returnModes.join("/")}` : "";
  const returnPart = basisText ? ` — home counted on ${basisText}${modesText}` : "";
  return `Binding constraint: ${constraintText}${returnPart}`;
}

function formatLatestLeaveAt(value) {
  if (value == null) return "not open at this arrival";
  if (value === "UNDETERMINED") return "no known closing constraint within the verified span";
  return formatClockFromAbs(value);
}

function metricsLine(candidate) {
  const basisNote = candidate.metricsBasis === "hours_only" ? " (hours only — return unverified)" : "";
  return `Usable: ${formatMinutesDisplay(candidate.usableMinutesMid)}${basisNote} · latest leave: ${formatLatestLeaveAt(candidate.latestLeaveAt)} · ends ~${formatClockFromAbs(candidate.sessionEndMidAbs)} · ${candidate.travelMinutesMid}m travel`;
}

function rankingLine(candidate) {
  return `Backup: ${candidate.backupStrength} · Preference rank: ${candidate.preference}`;
}

function renderCandidateCard(candidate, title) {
  const venue = venueById(candidate.venueId);
  const card = el("article", { class: `plan-card tier-${candidate.tier}` });
  card.appendChild(el("h3", { text: `${title}: ${displayName(candidate.venueId)}` }));
  if (venue) card.appendChild(el("p", { class: "area", text: venue.area }));
  card.appendChild(el("p", { class: "tier", text: feasibilityLine(candidate) }));
  card.appendChild(el("p", { class: "binding", text: bindingLine(candidate) }));
  card.appendChild(el("p", { class: "seat-confidence", text: seatConfidenceLine(candidate) }));
  card.appendChild(el("p", { class: "metrics", text: metricsLine(candidate) }));
  card.appendChild(el("p", { class: "ranking", text: rankingLine(candidate) }));

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
    card.appendChild(renderPlanBSummary(candidate.planB));
  } else {
    card.appendChild(el("p", { class: "plan-b-summary", text: "No viable fallback if full." }));
  }
  return card;
}

function renderPlanBSummary(planB) {
  const venue = venueById(planB.venueId);
  const label = venue ? `${displayName(planB.venueId)} (${venue.area})` : displayName(planB.venueId);
  const text =
    planB.strength === "strong"
      ? `If full: ${label} via ${planB.mode} — full session, ${planB.overallTier}`
      : `If full: ${label} via ${planB.mode} — salvage only, gives ${formatMinutesDisplay(planB.usableMinutesMid)}, ${planB.overallTier}`;
  return el("p", { class: "plan-b-summary", text });
}

function renderRemovalNotice(removal) {
  const label = venueById(removal.venueId) ? displayName(removal.venueId) : removal.venueId;
  return el("li", { text: `${label}: ${removal.reason}` });
}

function renderAlternatives(alternatives) {
  // Every alternative gets the same full card as Plan A (PLAN.md:1754) —
  // grouped by area, but not reduced to a thinner summary.
  const container = el("div", { class: "alternatives" });
  for (const [area, candidates] of Object.entries(alternatives)) {
    const section = el("section", { class: "area-group" });
    section.appendChild(el("h4", { text: area }));
    for (const candidate of candidates) {
      section.appendChild(renderCandidateCard(candidate, displayName(candidate.venueId)));
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
    min: "60",
    step: "15",
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

// --- render(state): app.js renders; it decides nothing. ---------------------

function render(state) {
  const root = document.getElementById("app");
  root.replaceChildren();
  root.appendChild(renderControls(state.controls));

  const result = state.result;
  if (!result) return;

  if (result.refusals.noLowRiskOption) {
    root.appendChild(el("p", { class: "refusal", text: "No low-risk option found for the requested session." }));
  }
  if (result.refusals.noVerifiedReturn) {
    root.appendChild(
      el("p", {
        class: "refusal",
        text: `No option with a verified way home for a session ending at ${result.refusals.noVerifiedReturn}.`,
      })
    );
  }

  if (result.planA) {
    root.appendChild(renderCandidateCard(result.planA, "Plan A"));
  }

  root.appendChild(el("h2", { text: "More alternatives" }));
  root.appendChild(renderAlternatives(result.alternatives));

  if (result.travelUnknown.length) {
    const section = el("section", { class: "travel-unknown" });
    section.appendChild(el("h4", { text: "Travel time not yet measured" }));
    const list = el("ul");
    for (const entry of result.travelUnknown) {
      list.appendChild(el("li", { text: venueById(entry.venueId) ? displayName(entry.venueId) : entry.venueId }));
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
