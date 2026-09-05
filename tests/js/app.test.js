import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StubDocument, StubFormData } from "./dom-stub.js";
import { rankVenues, CONTROL_CONTRACT } from "../../web/ranking.js";

// --- fixture builders (mirrors tests/js/ranking.test.js's own private
// helpers — not shared across test files, consistent with the existing
// one-fixture-per-file convention) --------------------------------------

function known(periods) {
  return { state: "known", periods };
}
function closed() {
  return { state: "closed", periods: [] };
}

function makeVenue() {
  const allWeekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const regular_hours = {};
  for (const w of allWeekdays) {
    // 2024-01-01 (BASE_CONTROLS.departureDate below) is a Monday.
    regular_hours[w] = w === "mon" ? known([{ open: 0, always_open: true }]) : closed();
  }
  return {
    id: "test-venue",
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
      current_hours_valid_from: "2099-01-01",
      current_hours_valid_through: "2099-01-07",
      current_hours_by_date: {},
      regular_hours,
    },
  };
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
  const stubDoc = new StubDocument();
  const root = stubDoc.createElement("div");
  stubDoc.registerById("app", root);
  globalThis.document = stubDoc;

  appModule.state.venues = [makeVenue()];
  appModule.state.controls = { ...CONTROLS };
  appModule.state.result = rankVenues({ venues: appModule.state.venues, holidays: {} }, appModule.state.controls);

  appModule.render(appModule.state);

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
  const stubDoc = new StubDocument();
  const root = stubDoc.createElement("div");
  stubDoc.registerById("app", root);
  globalThis.document = stubDoc;

  appModule.state.venues = [makeVenue()];
  appModule.state.controls = { ...CONTROLS };
  appModule.state.result = rankVenues({ venues: appModule.state.venues, holidays: {} }, appModule.state.controls);
  appModule.render(appModule.state);

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
  const stubDoc = new StubDocument();
  const root = stubDoc.createElement("div");
  stubDoc.registerById("app", root);
  globalThis.document = stubDoc;
  globalThis.FormData = StubFormData;

  appModule.state.venues = [makeVenue()];
  appModule.state.controls = { ...CONTROLS };
  appModule.state.result = rankVenues({ venues: appModule.state.venues, holidays: {} }, appModule.state.controls);
  appModule.render(appModule.state);

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
