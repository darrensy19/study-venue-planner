import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StubDocument, StubFormData } from "./dom-stub.js";
import { rankVenues, CONTROL_CONTRACT } from "../../web/ranking.js";

// --- fixture builders (mirrors tests/js/ranking.test.js's own private
// helpers — not shared across test files, consistent with the existing
// one-fixture-per-file convention). `name` is added here (absent from
// ranking.test.js's fixtures) because naming is exactly what this file
// exercises: without it, `displayName` falls back to the venue id, which
// would let a renderer that never reads `displayName` at all still pass by
// coincidence. ---------------------------------------------------------

function known(periods) {
  return { state: "known", periods };
}
function closed() {
  return { state: "closed", periods: [] };
}

function makeVenue({ validFrom = "2099-01-01", validThrough = "2099-01-07", byDate = {}, regular } = {}) {
  const allWeekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const regular_hours = {};
  for (const w of allWeekdays) {
    // 2024-01-01 (BASE_CONTROLS.departureDate below) is a Monday.
    regular_hours[w] = (regular && regular[w]) ?? (w === "mon" ? known([{ open: 0, always_open: true }]) : closed());
  }
  return {
    id: "test-venue",
    name: "Test Venue",
    preference: 1,
    area: "Test Area",
    baseline_seatability: "dependable",
    business_status: "OPERATIONAL",
    access: { home: { walk: { band: "5-10m", rank: 1 } } },
    return_transport_status: { state: "ok" },
    popularTimes: {},
    fallbacks: [],
    closing_buffer_minutes: 0,
    hours: {
      current_hours_valid_from: validFrom,
      current_hours_valid_through: validThrough,
      current_hours_by_date: byDate,
      regular_hours,
    },
  };
}

function fullVenue(overrides = {}) {
  const {
    id,
    name = "Test Venue",
    preference = 1,
    area = "Test Area",
    baseline = "dependable",
    businessStatus = "OPERATIONAL",
    access = { home: { walk: { band: "5-10m", rank: 1 } } },
    returnStatus = { state: "ok" },
    validFrom = "2099-01-01",
    validThrough = "2099-01-07",
    byDate = {},
    regular,
    popularTimes = {},
    fallbacks = [],
    hoursStatus,
    histogramStatus,
  } = overrides;
  const v = makeVenue({ validFrom, validThrough, byDate, regular });
  Object.assign(v, {
    id,
    name,
    preference,
    area,
    baseline_seatability: baseline,
    business_status: businessStatus,
    access,
    return_transport_status: returnStatus,
    popularTimes,
    fallbacks,
  });
  if (hoursStatus) v.hours.status = hoursStatus;
  if (histogramStatus) v.histogram = { status: histogramStatus };
  return v;
}

const CONTROLS = {
  origin: "home",
  mode: "walk",
  raining: false,
  departureDate: "2024-01-01", // a Monday
  leaveAtMinutes: 600,
  durationMinutes: 180,
  toleranceMinutes: 15,
  returnToleranceMinutes: 10,
  cycleLatestMinutes: null,
  seatCheckBufferMinutes: 10,
  minSessionMinutes: 90,
  minConfidence: "mixed",
};

function renderWith(venues, controls) {
  const stubDoc = new StubDocument();
  const root = stubDoc.createElement("div");
  stubDoc.registerById("app", root);
  globalThis.document = stubDoc;

  appModule.state.venues = venues;
  appModule.state.controls = controls;
  appModule.state.result = rankVenues({ venues, holidays: {} }, controls);
  appModule.render(appModule.state);
  return root;
}

// --- importability -----------------------------------------------------

let appModule;

test("web/app.js imports cleanly under Node with no `document` global at all", async () => {
  assert.equal(typeof document, "undefined");
  appModule = await import("../../web/app.js");
  assert.equal(typeof appModule.render, "function");
  assert.equal(typeof appModule.state, "object");
});

// --- render(): node creation, structure, text, classes/attributes ------

test("render() produces a controls form and a Plan A card for an always-open venue", () => {
  const root = renderWith([makeVenue()], { ...CONTROLS });

  assert.equal(root.children[0].tagName, "FORM");

  const planACard = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.ok(planACard, "expected a rendered Plan A card");
  assert.equal(planACard.className, "plan-card tier-robust");
  assert.match(planACard.textContent, /Plan A: Test Venue/);
});

// round-1 review finding IMP-019-R1-F01: the rendered form must build its
// origin/mode options and duration bounds from ranking.js's CONTROL_CONTRACT,
// never from locally re-declared literals. This is diagnostic on its own —
// before the fix, the form rendered a duration min of 60 while
// CONTROL_CONTRACT.duration.min is 180, so this test would have failed
// against the old, duplicated-literal code, not merely against a
// hypothetically-drifted contract.
test("renderControls builds origin/mode options and duration bounds from CONTROL_CONTRACT, not local literals", () => {
  const root = renderWith([makeVenue()], { ...CONTROLS });
  const form = root.children[0];
  assert.equal(form.tagName, "FORM");

  const originSelect = form.findByName("origin");
  assert.deepEqual(originSelect.children.map((opt) => opt.getAttribute("value")), CONTROL_CONTRACT.origins);

  const modeSelect = form.findByName("mode");
  assert.deepEqual(modeSelect.children.map((opt) => opt.getAttribute("value")), CONTROL_CONTRACT.modes);

  const durationField = form.findByName("durationMinutes");
  assert.equal(durationField.getAttribute("min"), String(CONTROL_CONTRACT.duration.min));
  assert.equal(durationField.getAttribute("max"), String(CONTROL_CONTRACT.duration.max));
  assert.equal(durationField.getAttribute("step"), String(CONTROL_CONTRACT.duration.step));
});

// --- event-driven rendering: submitting the controls form recomputes and
// re-renders, through app.js's real handler — only the DOM and FormData are
// faked. -----------------------------------------------------------------

test("submitting the controls form recomputes state and re-renders with the new value", () => {
  globalThis.FormData = StubFormData;
  const root = renderWith([makeVenue()], { ...CONTROLS });

  const originalForm = root.children[0];
  assert.equal(originalForm.tagName, "FORM");

  const durationField = originalForm.findByName("durationMinutes");
  assert.ok(durationField, "expected a durationMinutes input in the rendered form");
  durationField.setAttribute("value", "90");

  originalForm.dispatchEvent({ type: "submit", preventDefault() {} });

  assert.equal(appModule.state.controls.durationMinutes, 90);
  assert.notEqual(root.children[0], originalForm, "expected the form to be re-rendered as a new node");
});

// --- tolerance ownership (PLAN.md/CLAUDE.md "tolerance ownership") ----------
// Asserted against the source itself, per CLAUDE.md's "Review-response
// coverage": placement is the contract here, not behaviour — ranking.js owns
// FEASIBILITY_TOLERANCE_MINUTES and its default; app.js must not redeclare it.

test("web/app.js declares no FEASIBILITY_TOLERANCE_MINUTES of its own", () => {
  const appSource = readFileSync(fileURLToPath(new URL("../../web/app.js", import.meta.url)), "utf8");
  // A prose mention (e.g. explaining that ranking.js owns it) is fine; a
  // declaration or an assigned field of that exact name is what must be gone.
  assert.doesNotMatch(appSource, /\b(?:const|let|var)\s+FEASIBILITY_TOLERANCE_MINUTES\b/);
  assert.doesNotMatch(appSource, /\bFEASIBILITY_TOLERANCE_MINUTES\s*:/);
});

// --- Slice 2: naming — displayName / disambiguatedLabel, never a locally
// reconstructed name (PLAN.md's "Naming and presentation hierarchy") --------

test("naming: Plan A shows displayName plain plus a separate area line; a same-named removed venue shows disambiguatedLabel inline", () => {
  const ranked = fullVenue({ id: "v1", name: "Sunrise Cafe", area: "Bishan", preference: 1 });
  const removedTwin = fullVenue({
    id: "v2",
    name: "Sunrise Cafe", // duplicate display name -> disambiguation kicks in
    area: "Toa Payoh",
    preference: 2,
    businessStatus: "CLOSED_PERMANENTLY",
  });
  const root = renderWith([ranked, removedTwin], { ...CONTROLS });

  const planACard = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(planACard.textContent, /Plan A: Sunrise Cafe(?! \()/); // no area suffix in the heading
  assert.match(planACard.textContent, /Bishan/); // area shown on its own line

  const removedSection = root.children.find((child) => child.className === "removed");
  assert.ok(removedSection, "expected a removal notice section");
  assert.match(removedSection.textContent, /Sunrise Cafe \(Toa Payoh\)/); // disambiguatedLabel, inline
});

test("naming: the travel-time-unknown list uses disambiguatedLabel", () => {
  const primary = fullVenue({ id: "hard-filtered-avoider", preference: 1, name: "Alpha Cafe" });
  const unknownTravel = fullVenue({
    id: "unknown-travel",
    name: "Alpha Cafe", // duplicate, to prove disambiguatedLabel (not displayName) is used
    area: "Novena",
    preference: 2,
    access: { home: { walk: null } },
  });
  const root = renderWith([primary, unknownTravel], { ...CONTROLS });

  const section = root.children.find((child) => child.className === "travel-unknown");
  assert.ok(section, "expected a travel-time-unknown section");
  assert.match(section.textContent, /Alpha Cafe \(Novena\)/);
});

// --- Slice 2: day markers — every instant that can cross midnight carries
// one (PLAN.md's "Naming and presentation hierarchy": "A session ending at
// 04:07 must read as day-marked, not as an unqualified '04:07'.") -----------

test("day markers: an achievable end and binding limit that fall on the next calendar day both carry that date", () => {
  const venue = fullVenue({
    id: "v1",
    // Monday 22:00 crossing into Tuesday: a regular-authority period that
    // crosses midnight is only trusted once the next date's own period
    // confirms it (ranking.js's effectiveClose "needs verification" rule) —
    // so the real close of 02:00 lives on Tuesday's own entry.
    regular: {
      mon: known([{ open: 1320, close: 1441 }]),
      tue: known([{ open: 0, close: 120 }]),
    },
  });
  const controls = { ...CONTROLS, leaveAtMinutes: 1320, durationMinutes: 180 }; // depart 22:00, arrive 22:07 (7m walk), ends 01:07 next day
  const root = renderWith([venue], controls);

  const planACard = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.ok(planACard, "expected a Plan A card (full session fits within the overnight period)");
  assert.match(planACard.textContent, /ends ~01:07 \(2024-01-02\)/);
  assert.match(planACard.textContent, /Leave the venue by: 02:00 \(2024-01-02\)/);
});

test("day markers: an instant on the same calendar day as departure carries no date suffix", () => {
  const root = renderWith([makeVenue()], { ...CONTROLS }); // always-open Monday, 10:00 + 3h
  const planACard = root.children.find((child) => child.className.startsWith("plan-card"));
  // "no known closing constraint" (COVERED/always_open) has no clock at all,
  // but the metrics line's "latest leave" clause is a real same-day instant.
  assert.doesNotMatch(planACard.textContent, /\(2024-01-0[12]\)/);
});

// --- Slice 2: label vocabulary — seat_confidence / baseline_seatability /
// busyness bands never render a raw identifier -------------------------------

test("label vocabulary: baseline_seatability and seat_confidence render friendly text, never the raw token", () => {
  const root = renderWith([fullVenue({ id: "v1", baseline: "usually_available" })], { ...CONTROLS });
  const planACard = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.doesNotMatch(planACard.textContent, /usually_available/);
  assert.match(planACard.textContent, /Baseline: Good/);
});

// --- Slice 2: the pre-existing defect fix — "ends ~" must read the
// achievable end, and state the shortfall against the requested duration ----

test("metrics: a shorter-than-requested session states 'of the Xh you asked for', reading achievableSessionEndMid", () => {
  const venue = fullVenue({
    id: "v1",
    // Closes at offset 777 (12:57); a 10:00 departure + 7m walk arrives at
    // 10:07, so the venue gives only 2h50m of the requested 3h (tight, a
    // 10-minute known shortfall within FEASIBILITY_TOLERANCE_MINUTES).
    regular: { mon: known([{ open: 0, close: 777 }]) },
  });
  const root = renderWith([venue], { ...CONTROLS });
  assert.equal(appModule.state.result.resultState, "plan_a");
  assert.equal(appModule.state.result.planA.tier, "tight");

  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(card.textContent, /Usable: 2h 50m of the 3h you asked for/);
  assert.match(card.textContent, /ends ~12:57/);
});

test("metrics: a usableMinutesMid of undefined renders 'closed when you'd arrive', never 'Usable: unknown'", () => {
  const venue = fullVenue({
    id: "v1",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": closed() },
  });
  const root = renderWith([venue], { ...CONTROLS, departureDate: "2026-08-31" });
  assert.equal(appModule.state.result.resultState, "session_does_not_fit");

  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(card.textContent, /closed when you'd arrive/);
  assert.doesNotMatch(card.textContent, /Usable: unknown/);
});

// --- Slice 2: resultState — every branch renders distinct, correct text ----

test("resultState invalid_request: renders every violated control, its supplied value and permitted range", () => {
  const root = renderWith([makeVenue()], { ...CONTROLS, mode: "teleport" });
  assert.equal(appModule.state.result.resultState, "invalid_request");
  const box = root.children.find((child) => child.className === "refusal invalid-request");
  assert.ok(box, "expected an invalid-request refusal box");
  assert.match(box.textContent, /mode/);
  assert.match(box.textContent, /teleport/);
});

test("resultState session_does_not_fit: renders the refusal and the pipeline-named bestAlternative, labelled not a recommendation", () => {
  const venue = fullVenue({
    id: "v1",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": closed() },
  });
  const root = renderWith([venue], { ...CONTROLS, departureDate: "2026-08-31" });
  assert.equal(appModule.state.result.resultState, "session_does_not_fit");

  const refusal = root.children.find((child) => child.className === "refusal");
  assert.ok(refusal, "expected a refusal paragraph");

  const note = root.children.find((child) => child.className === "note");
  assert.ok(note, "expected a 'not a recommendation' note");
  assert.match(note.textContent, /not a recommendation/);

  // The bestAlternative card follows the note.
  const noteIndex = root.children.indexOf(note);
  assert.ok(root.children[noteIndex + 1]?.className.startsWith("plan-card"));
});

test("resultState no_verified_return: renders refusalInstant as a day-marked absolute instant, never a bare clock time", () => {
  const venue = fullVenue({ id: "v1", access: { home: { transit: { band: "5-10m", rank: 1 } } } });
  // arrival 22:30 + 3h duration -> nominal end 01:30 the next calendar day.
  const controls = { ...CONTROLS, mode: "transit", leaveAtMinutes: 1350, durationMinutes: 180 };
  const root = renderWith([venue], controls);
  assert.equal(appModule.state.result.resultState, "no_verified_return");

  const refusal = root.children.find((child) => child.className === "refusal");
  assert.ok(refusal, "expected a refusal paragraph");
  assert.match(refusal.textContent, /01:30 \(2024-01-02\)/);
});

test("resultState no_low_risk_option: renders its own distinct refusal text", () => {
  // Fully robust hours/return, but a "poor" baseline never clears the mixed
  // confidence floor -- ranked, just not Plan-A-eligible (mirrors
  // ranking.test.js's own "no_low_risk_option" fixture).
  const venue = fullVenue({ id: "v1", baseline: "poor" });
  const root = renderWith([venue], { ...CONTROLS });
  assert.equal(appModule.state.result.resultState, "no_low_risk_option");
  assert.equal(appModule.state.result.planA, null);

  const refusal = root.children.find((child) => child.className === "refusal");
  assert.ok(refusal, "expected a refusal paragraph");
  assert.match(refusal.textContent, /No low-risk option found for the requested session/);
  assert.match(refusal.textContent, /Try a different time, or accept the risk/);
});

test("resultState nothing_evaluable: shows all four diagnostics simultaneously, from a mixed-cause fixture", () => {
  const hardFiltered = fullVenue({ id: "hard-filtered", preference: 1, access: { home: {} } });
  const travelUnknownVenue = fullVenue({ id: "unknown-travel", preference: 2, access: { home: { walk: null } } });
  const removedVenue = fullVenue({ id: "removed-venue", preference: 3, businessStatus: "CLOSED_PERMANENTLY" });
  const root = renderWith([hardFiltered, travelUnknownVenue, removedVenue], { ...CONTROLS });
  assert.equal(appModule.state.result.resultState, "nothing_evaluable");

  const box = root.children.find((child) => child.className === "refusal nothing-evaluable");
  assert.ok(box, "expected a nothing-evaluable box");
  assert.match(box.textContent, /1 venue\(s\) have no recorded route/);
  assert.match(box.textContent, /1 venue\(s\) have travel time not yet measured/);
  assert.match(box.textContent, /1 venue\(s\) were removed/);
});

// --- Slice 2: evidence freshness — always visible, never absorbed ----------

test("freshness: a stale hours source and a failed histogram source are both always-visible on the candidate", () => {
  const venue = fullVenue({ id: "v1", hoursStatus: "stale", histogramStatus: "failed" });
  const root = renderWith([venue], { ...CONTROLS });
  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(card.textContent, /Hours evidence: stale/);
  assert.match(card.textContent, /Busyness evidence: unavailable/);
});

// --- Slice 2: Plan B — travel transfer time and the exact salvage wording --

test("Plan B strong: names the fallback's disambiguatedLabel and its own transfer time", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [{ venue_id: "fb1", mode: "walk", travel_band: "1-3m" }],
  });
  const fallback = fullVenue({ id: "fb1", name: "Backup Cafe", preference: 2, baseline: "dependable" });
  const root = renderWith([primary, fallback], { ...CONTROLS });
  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(card.textContent, /If full: Backup Cafe via walk — 2m transfer, full session/);
});

test("Plan B freshness: a stale hours source on the fallback itself is always-visible, not just on the primary candidate", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [{ venue_id: "fb1", mode: "walk", travel_band: "1-3m" }],
  });
  const fallback = fullVenue({
    id: "fb1",
    name: "Backup Cafe",
    preference: 2,
    baseline: "dependable",
    hoursStatus: "stale",
    histogramStatus: "failed",
  });
  const root = renderWith([primary, fallback], { ...CONTROLS });
  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  // The primary candidate itself has no freshness issue -- these warnings can
  // only be coming from the nested planB view, proving renderPlanBSummary
  // (not renderCandidateCard) is what surfaces them.
  assert.match(card.textContent, /Hours evidence: stale/);
  assert.match(card.textContent, /Busyness evidence: unavailable/);
});

test("Plan B salvage: states its actual duration against the requested one, per CLAUDE.md's exact wording pattern", () => {
  // Hand-built candidate — constructing a real salvage-tier fallback through
  // rankVenues() would duplicate ranking.test.js's own salvage-floor
  // coverage; app.js's contract is the documented returned shape, so a
  // directly-constructed instance of that shape is the right boundary for
  // testing the renderer alone.
  const stubDoc = new StubDocument();
  const root = stubDoc.createElement("div");
  stubDoc.registerById("app", root);
  globalThis.document = stubDoc;

  const candidate = {
    venueId: "v1", area: "Test Area", displayName: "Test Venue", disambiguatedLabel: "Test Venue",
    tier: "robust", seatConfidence: { confidence: "dependable" }, baselineSeatability: "dependable",
    busynessBand: { band: "typical" }, backupStrength: "salvage", travelMinutesMid: 5, preference: 1,
    usableMinutesMid: 240, achievableSessionEndMid: 600 + 240, latestLeaveAt: "UNDETERMINED",
    latestLeaveAtState: "undetermined", bindingLimitMid: "UNDETERMINED", metricsBasis: "combined",
    hoursTier: "robust", returnTier: "robust", bindingConstraint: "none", returnBasis: "schedule_free",
    returnModes: ["walk"],
    planB: {
      venueId: "fb1", mode: "walk", overallTier: "shorter", strength: "salvage",
      usableMinutesMid: 100, travelMinutesMid: 6, displayName: "Salvage Cafe",
      disambiguatedLabel: "Salvage Cafe", hoursStatus: "ok", histogramStatus: "ok",
    },
  };
  appModule.state.controls = { ...CONTROLS, durationMinutes: 240 };
  appModule.state.result = { resultState: "plan_a", planA: candidate, alternatives: {}, travelUnknown: [], removed: [] };
  appModule.render(appModule.state);

  const card = root.children.find((child) => child.className.startsWith("plan-card"));
  assert.match(card.textContent, /If full: Salvage Cafe via walk — 6m transfer, salvage: gives 1h 40m, not the 4h you asked for/);
});
