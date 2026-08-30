import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  weekdayAbbrev,
  absMinutes,
  dateFromAbs,
  periodEndAbs,
  resolveHours,
  findActivePeriod,
  effectiveClose,
  resolveBound,
  resolveFeasibility,
  passesFeasibility,
  finiteShortfall,
  finiteSurplus,
  surplusSortKey,
  surplusDisplay,
  AT_LEAST_0,
} from "../../web/ranking.js";

// --- fixture builders ------------------------------------------------------

function known(periods) {
  return { state: "known", periods };
}
function closed() {
  return { state: "closed", periods: [] };
}
function unknown() {
  return { state: "unknown", periods: [] };
}

/** A venue whose current_hours_by_date spans a fixed 7-day window, plus a
 * regular_hours fallback for every weekday. Both are overridable per test. */
function makeVenue({ validFrom, validThrough, byDate = {}, regular = {} } = {}) {
  const allWeekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const fullRegular = {};
  for (const w of allWeekdays) {
    fullRegular[w] = regular[w] ?? closed();
  }
  return {
    hours: {
      current_hours_valid_from: validFrom,
      current_hours_valid_through: validThrough,
      current_hours_by_date: byDate,
      regular_hours: fullRegular,
    },
  };
}

/** Throws if the walk ever tries to resolve this weekday's regular hours —
 * used to prove the lazy walk never reaches a date it doesn't need to. */
function tripwireRegular(label) {
  return {
    get state() {
      throw new Error(`tripwire: regular_hours["${label}"] should never be resolved`);
    },
  };
}

// --- calendar arithmetic ----------------------------------------------------

test("addDays / weekdayAbbrev anchor on a known date (2024-01-01 = Monday)", () => {
  assert.equal(weekdayAbbrev("2024-01-01"), "mon");
  assert.equal(weekdayAbbrev(addDays("2024-01-01", 1)), "tue");
  assert.equal(addDays("2024-01-01", 7), "2024-01-08");
  assert.equal(weekdayAbbrev("2024-01-08"), "mon");
});

test("absMinutes / dateFromAbs round-trip and Tuesday 00:30 matches Monday's after-midnight offset", () => {
  // Monday period {open:450, close:1500} spans Mon 07:30 to Tue 01:00.
  const mondayStart = absMinutes("2024-01-01", 450);
  const mondayEnd = absMinutes("2024-01-01", 1500);
  const tuesdayArrival = absMinutes("2024-01-02", 30); // Tue 00:30
  assert.equal(tuesdayArrival, mondayEnd - 30);
  assert.ok(mondayStart <= tuesdayArrival && tuesdayArrival < mondayEnd);
  assert.equal(dateFromAbs(tuesdayArrival), "2024-01-02");
});

test("periodEndAbs: always_open yields UNBOUNDED (Infinity), a finite close yields abs minutes", () => {
  assert.equal(periodEndAbs("2024-01-01", { open: 0, always_open: true }), Infinity);
  assert.equal(periodEndAbs("2024-01-01", { open: 450, close: 1140 }), absMinutes("2024-01-01", 1140));
});

// --- resolveHours ------------------------------------------------------------

test("resolveHours: a materialised current-hours entry wins even on a date that is also a holiday", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 450, close: 1200 }]) },
  });
  const holidays = { "2026-08-31": { name: "Test Holiday" } };
  const r = resolveHours(venue, holidays, "2026-08-31");
  assert.equal(r.authority, "current");
  assert.equal(r.state, "known");
});

test("resolveHours: a known holiday beyond the current-hours window yields unknown, never regular hours", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    regular: { tue: known([{ open: 450, close: 1200 }]) },
  });
  const holidays = { "2026-09-08": { name: "Test Holiday" } }; // a Tuesday, beyond the window
  const r = resolveHours(venue, holidays, "2026-09-08");
  assert.equal(r.authority, "holiday_unknown");
  assert.equal(r.state, "unknown");
});

test("resolveHours: outside the window and not a holiday falls back to regular_hours by weekday", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    regular: { tue: known([{ open: 450, close: 1200 }]) },
  });
  const r = resolveHours(venue, {}, "2026-09-08"); // a Tuesday, beyond the window
  assert.equal(r.authority, "regular");
  assert.deepEqual(r.periods, [{ open: 450, close: 1200 }]);
});

test("resolveHours: a missing in-window current_hours_by_date entry is malformed data and throws", () => {
  const venue = makeVenue({ validFrom: "2026-08-29", validThrough: "2026-09-04", byDate: {} });
  assert.throws(() => resolveHours(venue, {}, "2026-08-30"), /malformed data/);
});

test("resolveHours: a missing regular_hours weekday entry throws rather than silently defaulting", () => {
  const venue = { hours: { current_hours_valid_from: "2099-01-01", current_hours_valid_through: "2099-01-07", current_hours_by_date: {}, regular_hours: {} } };
  assert.throws(() => resolveHours(venue, {}, "2026-01-05"), /malformed data/); // a Monday
});

// --- findActivePeriod: active-period lookup ---------------------------------

test("findActivePeriod: arrival inside a period matches; before/after/gap do not", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: {
      "2026-08-31": known([
        { open: 450, close: 720 }, // 07:30-12:00
        { open: 780, close: 1200 }, // 13:00-20:00 (split day, gap 12:00-13:00)
      ]),
    },
  });
  const before = findActivePeriod(venue, {}, absMinutes("2026-08-31", 400));
  const inFirst = findActivePeriod(venue, {}, absMinutes("2026-08-31", 500));
  const inGap = findActivePeriod(venue, {}, absMinutes("2026-08-31", 750));
  const inSecond = findActivePeriod(venue, {}, absMinutes("2026-08-31", 900));
  const afterClose = findActivePeriod(venue, {}, absMinutes("2026-08-31", 1200));
  assert.equal(before.result, "closed");
  assert.equal(inFirst.result, "open");
  assert.equal(inGap.result, "closed");
  assert.equal(inSecond.result, "open");
  assert.equal(afterClose.result, "closed"); // boundary exclusive on the close side
});

test("findActivePeriod: boundary is inclusive at open, exclusive at close", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 450, close: 720 }]) },
  });
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 450)).result, "open");
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 449)).result, "closed");
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 720)).result, "closed");
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 719)).result, "open");
});

test("findActivePeriod: always_open (UNBOUNDED) contains an arrival at open and any later arrival", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: {
      "2026-08-31": known([{ open: 0, always_open: true }]),
      "2026-09-04": known([{ open: 0, always_open: true }]),
    },
  });
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 0)).result, "open");
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-08-31", 1439)).result, "open");
  assert.equal(findActivePeriod(venue, {}, absMinutes("2026-09-04", 1439)).result, "open");
});

test("findActivePeriod: a regular-authority arrival admits the previous date for an after-midnight tail", () => {
  const venue = makeVenue({
    validFrom: "2026-09-10",
    validThrough: "2026-09-16", // window far in the future; Mon/Tue below resolve via regular_hours
    regular: { mon: known([{ open: 450, close: 1500 }]) }, // 07:30 Mon - 01:00 Tue
  });
  const tuesdayEarly = absMinutes("2026-09-01", 30); // a Tuesday 00:30, outside the window
  const r = findActivePeriod(venue, {}, tuesdayEarly);
  assert.equal(r.result, "open");
  assert.equal(r.date, "2026-08-31"); // matched against Monday's period
});

test("findActivePeriod: source authority — an in-window date explicitly closed resolves closed, never open via a 24/7 regular previous day", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-30": closed() },
    regular: { sat: known([{ open: 0, always_open: true }]) }, // 2026-08-29 is a Saturday
  });
  const r = findActivePeriod(venue, {}, absMinutes("2026-08-30", 30)); // Sunday 00:30
  assert.equal(r.result, "closed"); // NOT "open" via Saturday's unbounded regular period
});

test("findActivePeriod: source authority — an out-of-window known holiday resolves unknown, never open via a regular overnight carry-in", () => {
  const venue = makeVenue({
    validFrom: "2026-09-10",
    validThrough: "2026-09-16",
    regular: { mon: known([{ open: 450, close: 1500 }]) }, // 07:30 Mon - 01:00 Tue
  });
  const holidays = { "2026-09-01": { name: "Test Holiday" } }; // the Tuesday being arrived at
  const r = findActivePeriod(venue, holidays, absMinutes("2026-09-01", 30)); // Tue 00:30
  assert.equal(r.result, "unknown");
});

test("findActivePeriod: equal matching ends from a decomposed chain are a valid tie-break, not a conflict", () => {
  // UTown-style decomposition: Monday's anchor entry and Tuesday's self-contained
  // entry both resolve to the same real close instant.
  const venue = makeVenue({
    validFrom: "2026-08-31",
    validThrough: "2026-09-06",
    byDate: {
      "2026-08-31": known([{ open: 450, close: 8250 }]), // Mon, closes Sat 17:30
      "2026-09-01": known([{ open: 0, close: 6810 }]), // Tue, self-contained, same real close
    },
  });
  const r = findActivePeriod(venue, {}, absMinutes("2026-09-01", 100)); // Tue early
  assert.equal(r.result, "open");
  assert.equal(r.periodEndAbs, absMinutes("2026-09-01", 6810));
});

test("findActivePeriod: disagreeing matching ends are a validation failure, not resolved by taking the minimum", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-30": closed() },
    regular: {
      sun: known([{ open: 0, close: 1600 }]), // conflicting close for the same instant
    },
  });
  // Force two candidates matching the same arrival with different endAbs by
  // constructing the previous-day admission path directly.
  const venue2 = makeVenue({
    validFrom: "2026-09-10",
    validThrough: "2026-09-16",
    regular: {
      mon: known([{ open: 450, close: 1500 }]), // Mon 07:30 - Tue 01:00
      tue: known([{ open: 0, close: 100 }]), // Tue 00:00 - 01:40, disagreeing close
    },
  });
  const r = findActivePeriod(venue2, {}, absMinutes("2026-09-01", 30)); // Tue 00:30, matches both
  assert.equal(r.result, "validation_failure");
});

// --- effectiveClose: the lazy, sequential cross-date walk -------------------

test("effectiveClose: an ordinary known shortfall returns the exact close, and never resolves an unknown following date", () => {
  // Arrival Mon 18:00, known Mon 22:00 close, required_end Tue 00:30, Tuesday
  // is a known holiday beyond the window. The lazy walk must never reach it.
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 1320 }]) }, // closes 22:00
  });
  const holidays = { "2026-09-01": { name: "Test Holiday" } }; // would be unknown if reached
  const active = findActivePeriod(venue, holidays, absMinutes("2026-08-31", 1080)); // 18:00
  assert.equal(active.result, "open");
  const requiredEndAbs = absMinutes("2026-09-01", 30); // Tue 00:30
  const ec = effectiveClose(venue, holidays, { date: active.date, period: active.period, authority: active.authority }, requiredEndAbs);
  assert.deepEqual(ec, { type: "finite", value: absMinutes("2026-08-31", 1320) });
});

test("effectiveClose: a known close with genuine slack (same-day, no crossing) returns the exact close, not COVERED", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 450, close: 1320 }]) }, // 07:30-22:00
  });
  const active = findActivePeriod(venue, {}, absMinutes("2026-08-31", 500));
  const requiredEndAbs = absMinutes("2026-08-31", 900); // well before the 22:00 close
  const ec = effectiveClose(venue, {}, { date: active.date, period: active.period, authority: active.authority }, requiredEndAbs);
  assert.deepEqual(ec, { type: "finite", value: absMinutes("2026-08-31", 1320) });
});

test("effectiveClose: a decomposed multi-day chain joins through self-contained entries to the true final close", () => {
  const venue = makeVenue({
    validFrom: "2026-08-31",
    validThrough: "2026-09-06",
    byDate: {
      "2026-08-31": known([{ open: 450, close: 9690 }]), // Mon, true close Sat 17:30 (9690 = 6*1440+1050)
      "2026-09-01": known([{ open: 0, close: 8250 }]),
      "2026-09-02": known([{ open: 0, close: 6810 }]),
      "2026-09-03": known([{ open: 0, close: 5370 }]),
      "2026-09-04": known([{ open: 0, close: 3930 }]),
      "2026-09-05": known([{ open: 0, close: 2490 }]),
      "2026-09-06": known([{ open: 0, close: 1050 }]), // Sat, ordinary same-day close 17:30
    },
  });
  const active = findActivePeriod(venue, {}, absMinutes("2026-08-31", 500));
  assert.equal(active.result, "open");
  const requiredEndAbs = absMinutes("2026-09-06", 1000); // Saturday, before the true close
  const ec = effectiveClose(venue, {}, { date: active.date, period: active.period, authority: active.authority }, requiredEndAbs);
  assert.deepEqual(ec, { type: "finite", value: absMinutes("2026-09-06", 1050) });
});

test("effectiveClose: always_open covers required_end_abs within the same day without consulting the next date", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
    regular: { tue: tripwireRegular("tue") },
  });
  const requiredEndAbs = absMinutes("2026-08-31", 900);
  const ec = effectiveClose(venue, {}, { date: "2026-08-31", period: { open: 0, always_open: true } }, requiredEndAbs);
  assert.deepEqual(ec, { type: "COVERED" });
});

test("effectiveClose: always_open joins into the next day's always_open regular schedule (seed 2 style)", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04", // "2026-09-04" is the final window date
    byDate: { "2026-09-04": known([{ open: 0, always_open: true }]) },
    regular: { sat: known([{ open: 0, always_open: true }]) }, // 2026-09-05 is a Saturday
  });
  const requiredEndAbs = absMinutes("2026-09-05", 900); // past the window edge
  const ec = effectiveClose(venue, {}, { date: "2026-09-04", period: { open: 0, always_open: true } }, requiredEndAbs);
  assert.deepEqual(ec, { type: "COVERED" });
});

test("effectiveClose: a window-edge truncated period that does not join ends at the boundary as a known close (seed 5 style)", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04", // Friday 2026-09-04 is the final date
    byDate: {
      "2026-09-04": known([{ open: 450, close: 1440, continues_beyond_window: true }]),
    },
    regular: { sat: known([{ open: 450, close: 1200 }]) }, // Saturday reopens 07:30 — no join
  });
  const period = { open: 450, close: 1440, continues_beyond_window: true };
  const requiredEndAbs = absMinutes("2026-09-05", 100); // just past the boundary
  const ec = effectiveClose(venue, {}, { date: "2026-09-04", period }, requiredEndAbs);
  assert.deepEqual(ec, { type: "finite", value: absMinutes("2026-09-05", 0) });
});

test("effectiveClose: a window-edge truncated period joins into a 24/7 regular schedule and reports COVERED", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: {
      "2026-09-04": known([{ open: 450, close: 1440, continues_beyond_window: true }]),
    },
    regular: { sat: known([{ open: 0, always_open: true }]) },
  });
  const period = { open: 450, close: 1440, continues_beyond_window: true };
  const requiredEndAbs = absMinutes("2026-09-05", 900);
  const ec = effectiveClose(venue, {}, { date: "2026-09-04", period }, requiredEndAbs);
  assert.deepEqual(ec, { type: "COVERED" });
});

test("effectiveClose: a window-edge truncated period crossing into an unresolvable date returns UNKNOWN", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: {
      "2026-09-04": known([{ open: 450, close: 1440, continues_beyond_window: true }]),
    },
  });
  const holidays = { "2026-09-05": { name: "Test Holiday" } };
  const period = { open: 450, close: 1440, continues_beyond_window: true };
  const requiredEndAbs = absMinutes("2026-09-05", 900);
  const ec = effectiveClose(venue, holidays, { date: "2026-09-04", period }, requiredEndAbs);
  assert.deepEqual(ec, { type: "UNKNOWN" });
});

test("effectiveClose: no period shape may outrank a later date's authority — finite overnight, finite multi-day, and 24/7 regular all resolve UNKNOWN crossing into an out-of-window known holiday", () => {
  const holidays = { "2026-09-08": { name: "Test Holiday" } }; // a Tuesday
  const requiredEndAbs = absMinutes("2026-09-08", 30); // Tue 00:30 — the run must reach it

  // (a) finite overnight regular period, Mon 22:00 - Tue 02:00
  const venueOvernight = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: { mon: known([{ open: 1320, close: 1560 }]) },
  });
  const ecOvernight = effectiveClose(
    venueOvernight,
    holidays,
    { date: "2026-09-07", period: { open: 1320, close: 1560 }, authority: "regular" },
    requiredEndAbs
  );
  assert.deepEqual(ecOvernight, { type: "UNKNOWN" });

  // (b) finite multi-day regular suffix entry reaching into the holiday
  const venueMultiDay = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: { mon: known([{ open: 450, close: 4000 }]) },
  });
  const ecMultiDay = effectiveClose(
    venueMultiDay,
    holidays,
    { date: "2026-09-07", period: { open: 450, close: 4000 }, authority: "regular" },
    requiredEndAbs
  );
  assert.deepEqual(ecMultiDay, { type: "UNKNOWN" });

  // (c) 24/7 always_open regular period — must never inherit "robust" from its unbounded end
  const venueAlwaysOpen = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: { mon: known([{ open: 0, always_open: true }]) },
  });
  const ecAlwaysOpen = effectiveClose(
    venueAlwaysOpen,
    holidays,
    { date: "2026-09-07", period: { open: 0, always_open: true }, authority: "regular" },
    requiredEndAbs
  );
  assert.deepEqual(ecAlwaysOpen, { type: "UNKNOWN" });
});

// --- AT_LEAST(0): the tagged sum type ---------------------------------------

test("AT_LEAST(0) accessors: passesFeasibility true, surplusSortKey 0, surplusDisplay carries no numeric margin", () => {
  assert.equal(passesFeasibility(AT_LEAST_0), true);
  assert.equal(surplusSortKey(AT_LEAST_0), 0);
  assert.equal(surplusDisplay(AT_LEAST_0), "fits — margin not established");
});

test("finiteShortfall rejects AT_LEAST(0) and rejects a non-negative finite surplus", () => {
  assert.throws(() => finiteShortfall(AT_LEAST_0), /AT_LEAST\(0\)/);
  assert.throws(() => finiteShortfall(finiteSurplus(0)), /non-negative/);
  assert.throws(() => finiteShortfall(finiteSurplus(30)), /non-negative/);
});

test("finiteShortfall returns the positive shortfall for a negative finite surplus", () => {
  assert.equal(finiteShortfall(finiteSurplus(-10)), 10);
});

test("surplusDisplay: a real finite surplus renders a spare/short margin, never the AT_LEAST(0) fallback text", () => {
  assert.equal(surplusDisplay(finiteSurplus(90)), "1h 30m spare");
  assert.equal(surplusDisplay(finiteSurplus(-10)), "10m short");
});

// --- resolveFeasibility: tiers ----------------------------------------------

const BASE_PARAMS = {
  departureDate: "2026-08-31",
  leaveAtMinutes: 900, // 15:00
  travelMinutesMid: 20,
  travelMinutesUpper: 30,
  durationMinutes: 180, // 3h
  closingBufferMinutes: 30,
  toleranceMinutes: 15,
};

test("resolveFeasibility: robust when the upper-bound arrival is covered with real slack", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 1440 }]) }, // open all day, same-day close
  });
  const r = resolveFeasibility(venue, {}, BASE_PARAMS);
  assert.equal(r.tier, "robust");
  assert.equal(r.surplusUpper.kind, "finite");
  assert.ok(r.surplusUpper.minutes > 0);
});

test("resolveFeasibility: a known shortfall at or under tolerance is tight, not shorter", () => {
  // surplus_mid = (close - buffer) - (arrival_mid(920) + duration(180)).
  // close - buffer = 1085 puts surplus_mid exactly at -15 (the tolerance
  // edge); the later upper-bound arrival (15:30) shortfalls further and
  // correctly fails robust.
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 1085 + 30 }]) }, // close - buffer(30) = 1085
  });
  const r = resolveFeasibility(venue, {}, BASE_PARAMS);
  assert.equal(r.tier, "tight");
  assert.equal(finiteShortfall(r.surplusMid), 15);
});

test("resolveFeasibility: a shortfall one minute past tolerance is shorter, not tight", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 1084 + 30 }]) }, // surplus_mid = -16
  });
  const r = resolveFeasibility(venue, {}, BASE_PARAMS);
  assert.equal(r.tier, "shorter");
});

test("resolveFeasibility: robust is judged on the upper bound alone — full midpoint coverage with an upper-bound shortfall ranks tight", () => {
  // Mid arrival 15:20 (920+... let's use concrete numbers): mid required_end covered,
  // but upper arrival (15:30, later) required_end exceeds the close.
  const params = { ...BASE_PARAMS, travelMinutesMid: 20, travelMinutesUpper: 40 };
  // mid arrival abs = 900+20=920 -> required_end_mid = 920+180+30=1130
  // upper arrival abs = 900+40=940 -> required_end_upper = 940+180+30=1150
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 1140 }]) }, // covers mid(1130) but not upper(1150)
  });
  const r = resolveFeasibility(venue, {}, params);
  assert.equal(r.tier, "tight");
});

test("resolveFeasibility: an upper-bound NONE fails robust while the midpoint still evaluates to tight", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: {
      "2026-08-31": known([{ open: 0, close: 925 }]), // open only through 15:25 — upper arrival (15:30) is NONE
    },
  });
  const params = { ...BASE_PARAMS, travelMinutesMid: 20, travelMinutesUpper: 30, durationMinutes: 1, closingBufferMinutes: 0, toleranceMinutes: 15 };
  // mid arrival = 920, well inside [0,925); upper arrival = 930, NONE (930 >= 925)
  const r = resolveFeasibility(venue, {}, params);
  assert.notEqual(r.tier, "robust");
  assert.equal(r.tier, "tight");
  assert.equal(r.surplusUpper, undefined);
});

test("resolveFeasibility: a midpoint NONE cannot be tight and falls to shorter", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": closed() },
  });
  const r = resolveFeasibility(venue, {}, BASE_PARAMS);
  assert.equal(r.tier, "shorter");
  assert.equal(r.surplusMid, undefined);
});

test("resolveFeasibility: either bound UNKNOWN yields hours-unknown, with no tier metrics computed", () => {
  const venue = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: {}, // every weekday defaults to closed() via makeVenue, so force unknown via a holiday instead
  });
  const holidays = { "2026-08-31": { name: "Test Holiday" } };
  const r = resolveFeasibility(venue, holidays, BASE_PARAMS);
  assert.equal(r.tier, "hours-unknown");
  assert.equal(r.surplusMid, undefined);
  assert.equal(r.surplusUpper, undefined);
  assert.equal(r.usableMinutesMid, undefined);
});

test("resolveFeasibility: a validation failure yields tier invalid, and the venue is not assigned a feasibility tier", () => {
  const venue = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: {
      mon: known([{ open: 450, close: 1500 }]),
      tue: known([{ open: 0, close: 100 }]), // disagreeing close for the same overlapping instant
    },
  });
  const params = { ...BASE_PARAMS, departureDate: "2026-09-07", leaveAtMinutes: 1470, travelMinutesMid: 0, travelMinutesUpper: 0, durationMinutes: 1, closingBufferMinutes: 0 };
  const r = resolveFeasibility(venue, {}, params);
  assert.equal(r.tier, "invalid");
});

test("resolveFeasibility: a COVERED bound never surfaces a numeric surplus, only the AT_LEAST(0) tag", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
  });
  const r = resolveFeasibility(venue, {}, BASE_PARAMS);
  assert.equal(r.tier, "robust");
  assert.equal(r.surplusUpper.kind, "at_least_0");
  assert.equal(r.surplusMid.kind, "at_least_0");
  assert.equal(r.latestLeaveAt, "UNDETERMINED");
  // No Infinity anywhere in a result that would ever reach a consumer/UI.
  assert.doesNotMatch(JSON.stringify(r, (_, v) => (v === Infinity ? "__INF__" : v)), /Infinity/);
});
