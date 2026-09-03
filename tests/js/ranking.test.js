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
  serviceDateFromAbs,
  clockMinutesOfDay,
  normaliseEdge,
  normaliseBand,
  lastDepartureEdge,
  normaliseTravelBand,
  resolveReturnService,
  admissibleReturnModes,
  resolveReturnBound,
  resolveReturnFeasibility,
  overallTier,
  combineBindingLimit,
  resolveOverallFeasibility,
  resolveFeasibilityAtArrivals,
  resolveOverallFeasibilityAtArrivals,
  validateReturnTransport,
  resolveBusynessBand,
  resolveSeatConfidence,
  resolvePlanBArrivals,
  meetsConfidenceFloor,
  resolveBackupStrength,
  evaluatePlanBFallback,
  resolveOutboundMode,
  validatePreferenceSnapshot,
  rankVenues,
  CLOSING_BUFFER_DEFAULT_MINUTES,
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

/** A return_transport value whose "origin_a" access throws if ever read —
 * used to prove resolveReturnBound never reads return_transport inside the
 * core-span, pre-dawn, or schedule-free branches. */
function tripwireReturnTransport() {
  return {
    get origin_a() {
      throw new Error("tripwire: return_transport should never be read here");
    },
  };
}

/** A venue carrying only return_transport (+ optional holiday_return_policy),
 * for resolveReturnService tests that don't need hours data. */
function venueWithReturnTransport(returnTransport, holidayReturnPolicy) {
  const v = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07" });
  v.return_transport = returnTransport;
  if (holidayReturnPolicy !== undefined) v.holiday_return_policy = holidayReturnPolicy;
  return v;
}

/** A venue carrying only access.origin_a, for admissibleReturnModes/
 * resolveReturnBound tests that don't need hours or return_transport data. */
function venueWithAccess(origin_a) {
  const v = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07" });
  v.access = { origin_a };
  return v;
}

/** A venue carrying only regular_hours[weekday] (a single period) and
 * popularTimes[weekday] (an array of {hour, busyness}), for
 * resolveBusynessBand tests. validFrom/validThrough sit far in the future so
 * every arrival date resolves via "regular" authority, matching busyness's
 * own per-weekday (not per-date) nature. */
function busynessVenue(weekday, period, entries) {
  const regular = {};
  regular[weekday] = known([period]);
  const v = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07", regular });
  v.popularTimes = { [weekday]: entries };
  return v;
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

// --- Return-transport: calendar-date arithmetic -----------------------------

test("serviceDateFromAbs: a 03:30 Saturday session belongs to Friday's service night (04:00 boundary)", () => {
  const saturday0330 = absMinutes("2026-09-05", 210); // Sat 03:30, 2026-09-05 is a Saturday
  assert.equal(serviceDateFromAbs(saturday0330), "2026-09-04"); // Friday
});

test("serviceDateFromAbs: exactly 04:00 belongs to its own calendar date, not the previous one", () => {
  const fourAM = absMinutes("2026-09-05", 240);
  assert.equal(serviceDateFromAbs(fourAM), "2026-09-05");
});

test("clockMinutesOfDay: recovers the offset-from-midnight component of an absolute minute", () => {
  assert.equal(clockMinutesOfDay(absMinutes("2026-09-05", 0)), 0);
  assert.equal(clockMinutesOfDay(absMinutes("2026-09-05", 930)), 930);
  assert.equal(clockMinutesOfDay(absMinutes("2026-09-05", 1439)), 1439);
});

// --- Return-transport: band parsing -----------------------------------------

test("normaliseEdge: worked values, including the pre-service-day-start wraparound", () => {
  assert.equal(normaliseEdge("23:20"), 1400);
  assert.equal(normaliseEdge("00:30"), 1470); // NOT 30 — wraps past RETURN_SERVICE_DAY_START_MINUTES
  assert.equal(normaliseEdge("04:00"), 240); // inclusive low edge of [240,1680)
  assert.equal(normaliseEdge("03:59"), 1679); // one below the exclusive high edge
});

test("normaliseEdge: rejects syntactically invalid clock strings", () => {
  assert.equal(normaliseEdge("23:5"), null);
  assert.equal(normaliseEdge("2360"), null);
  assert.equal(normaliseEdge("24:00"), null);
  assert.equal(normaliseEdge("23:60"), null);
  assert.equal(normaliseEdge("25:00"), null);
});

test("normaliseEdge: every valid HH:MM clock string lands in [240, 1680), as a property over all 1440 values", () => {
  for (let hh = 0; hh < 24; hh++) {
    for (let mm = 0; mm < 60; mm++) {
      const s = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const r = normaliseEdge(s);
      assert.ok(r >= 240 && r < 1680, `${s} normalised to ${r}, expected [240,1680)`);
    }
  }
});

test("normaliseBand: an ordinary evening band and a midnight-straddling band both normalise and pass", () => {
  assert.deepEqual(normaliseBand("23:20-23:25"), { kind: "present", lo: 1400, hi: 1405 });
  assert.deepEqual(normaliseBand("23:55-00:05"), { kind: "present", lo: 1435, hi: 1445 });
  assert.deepEqual(normaliseBand("00:30-00:35"), { kind: "present", lo: 1470, hi: 1475 });
});

test("normaliseBand: a band straddling the service-day boundary is malformed via the same lo<hi check", () => {
  assert.equal(normaliseBand("03:58-04:02").kind, "malformed");
});

test("normaliseBand: a syntactically malformed edge is malformed", () => {
  assert.equal(normaliseBand("25:00-25:05").kind, "malformed");
});

test("normaliseBand: three distinct malformed shapes — bad syntax, equal edges, inverted edges", () => {
  assert.equal(normaliseBand("23:5-23:10").kind, "malformed");
  assert.equal(normaliseBand("23:20-23:20").kind, "malformed"); // equal after normalisation
  assert.equal(normaliseBand("23:25-23:20").kind, "malformed"); // plainly inverted
});

test("lastDepartureEdge: upper bound takes the lower/earlier edge, mid takes the floored midpoint — the mirror of a travel band", () => {
  const band = { lo: 1400, hi: 1405 };
  assert.equal(lastDepartureEdge(band, "upper"), 1400);
  assert.equal(lastDepartureEdge(band, "mid"), 1402);
  // Contrast: a travel band's upper bound takes its UPPER edge, never merged with this rule.
  const travelBandUpperEdge = (b) => b.hi;
  assert.notEqual(lastDepartureEdge(band, "upper"), travelBandUpperEdge(band));
});

// --- Travel-band parsing (access[][].band, fallbacks[].travel_band) --------

test("normaliseTravelBand: an ordinary band normalises to a floored midpoint and the upper edge", () => {
  assert.deepEqual(normaliseTravelBand("15-20m"), { kind: "present", mid: 17, upper: 20 });
  assert.deepEqual(normaliseTravelBand("5-10m"), { kind: "present", mid: 7, upper: 10 });
});

test("normaliseTravelBand: an even-width band's midpoint needs no flooring", () => {
  assert.deepEqual(normaliseTravelBand("10-20m"), { kind: "present", mid: 15, upper: 20 });
});

test("normaliseTravelBand: explicit null is not_measured, distinct from malformed", () => {
  assert.deepEqual(normaliseTravelBand(null), { kind: "not_measured" });
});

test("normaliseTravelBand: syntactically malformed strings are malformed, never guessed", () => {
  assert.equal(normaliseTravelBand("15-20").kind, "malformed"); // missing "m" suffix
  assert.equal(normaliseTravelBand("15-20 min").kind, "malformed");
  assert.equal(normaliseTravelBand("abc").kind, "malformed");
  assert.equal(normaliseTravelBand("").kind, "malformed");
  assert.equal(normaliseTravelBand("-5-10m").kind, "malformed"); // no negative edges
});

test("normaliseTravelBand: equal and inverted edges are malformed, mirroring normaliseBand's lo<hi check", () => {
  assert.equal(normaliseTravelBand("10-10m").kind, "malformed"); // equal
  assert.equal(normaliseTravelBand("20-15m").kind, "malformed"); // inverted
});

test("normaliseTravelBand: non-string, non-null input is malformed rather than throwing", () => {
  assert.equal(normaliseTravelBand(42).kind, "malformed");
  assert.equal(normaliseTravelBand(undefined).kind, "malformed");
  assert.equal(normaliseTravelBand({ lo: 5, hi: 10 }).kind, "malformed");
});

// IMP-005-R1-F01: unrepresentable parsed edges and unserialisable malformed diagnostics
// must never produce a non-finite "present" result or throw.

test("normaliseTravelBand: an overflow-length digit band is malformed, never a non-finite present result", () => {
  const result = normaliseTravelBand(`1-${"9".repeat(400)}m`);
  assert.equal(result.kind, "malformed");
});

test("normaliseTravelBand: an edge beyond Number.MAX_SAFE_INTEGER is malformed even though it's still finite", () => {
  const unsafe = String(Number.MAX_SAFE_INTEGER + 2);
  const result = normaliseTravelBand(`1-${unsafe}m`);
  assert.equal(result.kind, "malformed");
});

test("normaliseTravelBand: a BigInt input is malformed rather than throwing during diagnostics", () => {
  assert.doesNotThrow(() => normaliseTravelBand(1n));
  assert.equal(normaliseTravelBand(1n).kind, "malformed");
});

test("normaliseTravelBand: an object with a throwing toJSON is malformed rather than throwing during diagnostics", () => {
  const throwingToJSON = { toJSON() { throw new Error("boom"); } };
  assert.doesNotThrow(() => normaliseTravelBand(throwingToJSON));
  assert.equal(normaliseTravelBand(throwingToJSON).kind, "malformed");
});

// --- Return-transport: resolveReturnService ---------------------------------

test("resolveReturnService: no return_transport block at all is missing", () => {
  const venue = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07" });
  const r = resolveReturnService(venue, {}, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "missing");
});

test("resolveReturnService: block present but this destination/mode absent is missing", () => {
  const venue = venueWithReturnTransport({ origin_a: { walk: {} } });
  const r = resolveReturnService(venue, {}, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "missing");
});

test("resolveReturnService: a selected entry with no last_departure_band is missing, never malformed", () => {
  const venue = venueWithReturnTransport({ origin_a: { transit: { default: {} } } });
  const r = resolveReturnService(venue, {}, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "missing");
});

test("resolveReturnService: falls back to default when no by_weekday override matches", () => {
  const venue = venueWithReturnTransport({
    origin_a: { transit: { default: { last_departure_band: "23:20-23:25" } } },
  });
  const r = resolveReturnService(venue, {}, "origin_a", "transit", "2026-09-04"); // a Friday
  assert.deepEqual(r, { kind: "present", lo: 1400, hi: 1405 });
});

test("resolveReturnService: a 03:30 Saturday session's service date (Friday) selects the fri by_weekday override, not sat's", () => {
  const venue = venueWithReturnTransport({
    origin_a: {
      transit: {
        default: { last_departure_band: "23:00-23:05" },
        by_weekday: {
          fri: { last_departure_band: "23:50-23:55" },
          sat: { last_departure_band: "23:10-23:15" },
        },
      },
    },
  });
  const saturday0330 = absMinutes("2026-09-05", 210); // Sat 03:30, 2026-09-05 is a Saturday
  const serviceDate = serviceDateFromAbs(saturday0330);
  assert.equal(serviceDate, "2026-09-04"); // Friday
  const r = resolveReturnService(venue, {}, "origin_a", "transit", serviceDate);
  assert.deepEqual(r, { kind: "present", lo: 1430, hi: 1435 }); // fri's band, not sat's
});

test("resolveReturnService: a malformed selected band is malformed, with a reason", () => {
  const venue = venueWithReturnTransport({
    origin_a: { transit: { default: { last_departure_band: "23:20-23:20" } } }, // equal after norm
  });
  const r = resolveReturnService(venue, {}, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "malformed");
  assert.ok(r.reason);
});

test("resolveReturnService: holiday_return_policy substitute_sun uses the sun by_weekday override on a holiday", () => {
  const venue = venueWithReturnTransport(
    {
      origin_a: {
        transit: {
          default: { last_departure_band: "23:00-23:05" },
          by_weekday: { sun: { last_departure_band: "22:00-22:05" } },
        },
      },
    },
    "substitute_sun"
  );
  const holidays = { "2026-09-04": { name: "Test Holiday" } };
  const r = resolveReturnService(venue, holidays, "origin_a", "transit", "2026-09-04");
  assert.deepEqual(r, { kind: "present", lo: 1320, hi: 1325 }); // sun's band, not default's
});

test("resolveReturnService: holiday_return_policy unknown (the default) on a holiday is missing, even though a default entry exists", () => {
  const venue = venueWithReturnTransport({
    origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } },
  }); // holiday_return_policy left unset -> "unknown"
  const holidays = { "2026-09-04": { name: "Test Holiday" } };
  const r = resolveReturnService(venue, holidays, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "missing");
});

test("resolveReturnService: holiday_return_policy is read independently of holiday_policy — a substitute_sun holiday_policy never leaks in", () => {
  const venue = venueWithReturnTransport({
    origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } },
  }); // no holiday_return_policy set
  venue.holiday_policy = "substitute_sun"; // the UNRELATED busyness-curve field
  const holidays = { "2026-09-04": { name: "Test Holiday" } };
  const r = resolveReturnService(venue, holidays, "origin_a", "transit", "2026-09-04");
  assert.equal(r.kind, "missing"); // still missing — holiday_policy must not be cross-read
});

// --- Return-transport: admissibleReturnModes --------------------------------

test("admissibleReturnModes: returns every recorded mode when nothing filters it out", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 }, walk: { band: "5-10m", rank: 2 } });
  const modes = admissibleReturnModes(venue, false, false, absMinutes("2026-09-04", 900), "2026-09-04");
  assert.deepEqual([...modes].sort(), ["transit", "walk"]);
});

test("admissibleReturnModes: bicycle_with_you=false removes cycle even if access records it", () => {
  const venue = venueWithAccess({ cycle: { band: "10-15m", rank: 1 } });
  const modes = admissibleReturnModes(venue, false, false, absMinutes("2026-09-04", 900), "2026-09-04");
  assert.ok(!modes.has("cycle"));
});

test("admissibleReturnModes: rain removes cycle even when bicycle_with_you is true", () => {
  const venue = venueWithAccess({ cycle: { band: "10-15m", rank: 1 } });
  const modes = admissibleReturnModes(venue, true, true, absMinutes("2026-09-04", 900), "2026-09-04");
  assert.ok(!modes.has("cycle"));
});

test("admissibleReturnModes: no access entry at all yields an empty set, never a silent default", () => {
  const venue = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07" });
  const modes = admissibleReturnModes(venue, false, false, absMinutes("2026-09-04", 900), "2026-09-04");
  assert.equal(modes.size, 0);
});

test("admissibleReturnModes: the cycle cutoff is compared via absMinutes(serviceDate, cutoff), never a raw offset", () => {
  // A real 2026 date is thousands of absolute minutes from epoch day 0. A
  // buggy raw comparison (sessionEndAbs > cycleLatestMinutes directly) would
  // almost always evaluate true and wrongly strip cycle here.
  const venue = venueWithAccess({ cycle: { band: "10-15m", rank: 1 } });
  const serviceDate = "2026-09-04";
  const cutoffAbs = absMinutes(serviceDate, 1500); // 01:00 next day
  const wellBeforeCutoff = cutoffAbs - 100;
  const modes = admissibleReturnModes(venue, true, false, wellBeforeCutoff, serviceDate, 1500);
  assert.ok(modes.has("cycle"));
});

test("admissibleReturnModes: mid and upper bounds can disagree on the admissible set when they straddle the cycle cutoff", () => {
  const venue = venueWithAccess({ cycle: { band: "10-15m", rank: 1 } });
  const serviceDate = "2026-09-04";
  const sessionEndMid = absMinutes(serviceDate, 1470); // 00:30 next day -- before the 01:00 cutoff (1500)
  const sessionEndUpper = absMinutes(serviceDate, 1530); // 01:30 next day -- after the 01:00 cutoff
  const modesMid = admissibleReturnModes(venue, true, false, sessionEndMid, serviceDate, 1500);
  const modesUpper = admissibleReturnModes(venue, true, false, sessionEndUpper, serviceDate, 1500);
  assert.ok(modesMid.has("cycle"));
  assert.ok(!modesUpper.has("cycle"));
});

test("admissibleReturnModes: cycleLatestMinutes=null (the production default) means no cutoff at all", () => {
  const venue = venueWithAccess({ cycle: { band: "10-15m", rank: 1 } });
  const farFuture = absMinutes("2026-09-04", 100000); // absurdly late, would fail any real cutoff
  const modes = admissibleReturnModes(venue, true, false, farFuture, "2026-09-04");
  assert.ok(modes.has("cycle"));
});

// --- Return-transport: resolveReturnBound -----------------------------------

test("resolveReturnBound: the route prerequisite fires inside the core span too — no access at all is unverified, never a pass", () => {
  const venue = venueWithAccess({});
  const sessionEnd = absMinutes("2026-09-04", 780); // 13:00, inside the core span
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "mid");
  assert.deepEqual(r, { kind: "unverified", basis: "no_recorded_route", modes: [] });
});

test("resolveReturnBound: inside the core span, zero return_transport reads and a pass; outside it with no data, unverified", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } }); // schedule-bound only
  venue.return_transport = tripwireReturnTransport();

  const insideSpan = absMinutes("2026-09-04", 780); // 13:00
  const inside = resolveReturnBound(venue, {}, false, false, insideSpan, "mid");
  assert.deepEqual(inside, { kind: "pass", basis: "core_span", margin: AT_LEAST_0, modes: ["transit"] });

  const venueNoData = venueWithAccess({ transit: { band: "20-25m", rank: 1 } }); // return_transport absent
  const outsideSpan = absMinutes("2026-09-04", 1320); // 22:00
  const outside = resolveReturnBound(venueNoData, {}, false, false, outsideSpan, "mid");
  assert.deepEqual(outside, { kind: "unverified", basis: "no_data", modes: ["transit"] });
});

test("resolveReturnBound: the core span is inclusive at both ends (21:30 exactly still resolves core_span)", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = tripwireReturnTransport();
  const exactlyBoundary = absMinutes("2026-09-04", 1290); // 21:30
  const r = resolveReturnBound(venue, {}, false, false, exactlyBoundary, "mid");
  assert.deepEqual(r, { kind: "pass", basis: "core_span", margin: AT_LEAST_0, modes: ["transit"] });
});

test("resolveReturnBound: pre-dawn is unverified on a schedule-bound-only set, with zero return_transport reads", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = tripwireReturnTransport();
  const preDawn = absMinutes("2026-09-04", 300); // 05:00
  const r = resolveReturnBound(venue, {}, false, false, preDawn, "mid");
  assert.deepEqual(r, { kind: "unverified", basis: "pre_dawn_gap", modes: ["transit"] });
});

test("resolveReturnBound: an admissible walk settles the pre-dawn gap as positive evidence, robust", () => {
  const venue = venueWithAccess({ walk: { band: "5-10m", rank: 1 } });
  venue.return_transport = tripwireReturnTransport(); // must never be read
  const preDawn = absMinutes("2026-09-04", 300); // 05:00
  const r = resolveReturnBound(venue, {}, false, false, preDawn, "mid");
  assert.deepEqual(r, { kind: "pass", basis: "schedule_free", margin: AT_LEAST_0, modes: ["walk"] });
});

test("resolveReturnBound: outside the core span and pre-dawn gap, resolves via the timetable against the service date", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:20-23:25" } } } };
  const sessionEnd = absMinutes("2026-09-04", 1320); // 22:00, past the core span
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "upper");
  assert.equal(r.kind, "pass");
  assert.equal(r.basis, "last_departure");
  assert.equal(r.lastDepartureAbs, absMinutes("2026-09-04", 1400)); // upper takes the lo edge, 23:20
});

test("resolveReturnBound: MAX (not MIN) over admissible schedule-bound modes — the later last departure wins", () => {
  const venue = venueWithAccess({
    transit: { band: "20-25m", rank: 1 },
    shuttle: { band: "20-25m", rank: 2 }, // a second, synthetic schedule-bound mode
  });
  venue.return_transport = {
    origin_a: {
      transit: { default: { last_departure_band: "22:00-22:05" } },
      shuttle: { default: { last_departure_band: "23:00-23:05" } },
    },
  };
  const sessionEnd = absMinutes("2026-09-04", 1320); // 22:00
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "mid");
  assert.equal(r.kind, "pass");
  assert.equal(r.lastDepartureAbs, absMinutes("2026-09-04", 1382)); // shuttle's later midpoint, not transit's
});

// IMP-012-R1-F01: `modes` is display-only (PLAN.md:1754's "return mode being
// counted on") and must never influence which departure wins — these two
// tests hold the winning timestamp fixed and vary only which mode(s) produced
// it, distinct from "MAX (not MIN)" above, which holds the modes fixed and
// varies the timestamps.
test("resolveReturnBound: last_departure basis names only the mode whose own departure is the later, binding one", () => {
  const venue = venueWithAccess({
    transit: { band: "20-25m", rank: 1 },
    bus: { band: "20-25m", rank: 2 }, // a second, synthetic schedule-bound mode
  });
  venue.return_transport = {
    origin_a: {
      transit: { default: { last_departure_band: "23:00-23:05" } }, // mid edge 1382 — binding
      bus: { default: { last_departure_band: "22:00-22:05" } }, // mid edge 1322 — earlier, not binding
    },
  };
  const sessionEnd = absMinutes("2026-09-04", 1320); // 22:00, past the core span
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "mid");
  assert.equal(r.kind, "pass");
  assert.equal(r.basis, "last_departure");
  assert.deepEqual(r.modes, ["transit"]);
});

test("resolveReturnBound: last_departure basis names every mode tied for the binding departure, not an arbitrary one", () => {
  const venue = venueWithAccess({
    transit: { band: "20-25m", rank: 1 },
    bus: { band: "20-25m", rank: 2 },
  });
  venue.return_transport = {
    origin_a: {
      transit: { default: { last_departure_band: "23:00-23:05" } }, // mid edge 1382
      bus: { default: { last_departure_band: "23:00-23:05" } }, // identical band — genuine tie
    },
  };
  const sessionEnd = absMinutes("2026-09-04", 1320); // 22:00, past the core span
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "mid");
  assert.equal(r.kind, "pass");
  assert.equal(r.basis, "last_departure");
  assert.deepEqual([...r.modes].sort(), ["bus", "transit"]);
});

test("resolveReturnBound: a malformed band on the only admissible mode unranks the venue as validation_failure, never unverified", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:20-23:20" } } } }; // equal after norm
  const sessionEnd = absMinutes("2026-09-04", 1320); // 22:00
  const r = resolveReturnBound(venue, {}, false, false, sessionEnd, "mid");
  assert.equal(r.kind, "validation_failure");
  assert.ok(r.reason);
});

// --- Return-transport: resolveReturnFeasibility / overallTier ---------------

test("resolveReturnFeasibility: robust when both bounds land in the core span", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = tripwireReturnTransport();
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 780), // 13:00
    sessionEndUpperAbs: absMinutes("2026-09-04", 800),
    toleranceMinutes: 10,
  });
  assert.equal(r.tier, "robust");
  assert.equal(r.returnMarginUpper, AT_LEAST_0);
});

test("resolveReturnFeasibility: an upper-bound shortfall with a mid-bound surplus ranks tight, not robust", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } }; // lo 1380 hi 1385
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 1370), // mid edge 1382, margin +12
    sessionEndUpperAbs: absMinutes("2026-09-04", 1385), // upper edge 1380, margin -5
    toleranceMinutes: 10,
  });
  assert.equal(r.tier, "tight");
});

test("resolveReturnFeasibility: a mid-bound shortfall past tolerance ranks shorter", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } };
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 1395), // mid edge 1382, margin -13, past tolerance 10
    sessionEndUpperAbs: absMinutes("2026-09-04", 1400),
    toleranceMinutes: 10,
  });
  assert.equal(r.tier, "shorter");
});

test("resolveReturnFeasibility: an omitted toleranceMinutes defaults to RETURN_TOLERANCE_MINUTES (10), a 10-minute shortfall still ranks tight", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } };
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 1392), // mid edge 1382, margin -10 -- exactly the default tolerance
    sessionEndUpperAbs: absMinutes("2026-09-04", 1400), // upper edge 1380, margin -20, not robust
    // toleranceMinutes intentionally omitted
  });
  assert.equal(r.tier, "tight");
});

test("resolveReturnFeasibility: either bound unverified makes the whole return tier unverified, never partially robust", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } }); // no return_transport data
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 780), // 13:00, core_span pass
    sessionEndUpperAbs: absMinutes("2026-09-04", 1320), // 22:00, no data -> unverified
    toleranceMinutes: 10,
  });
  assert.equal(r.tier, "unverified");
});

test("resolveReturnFeasibility: a validation failure on either bound yields tier invalid with a reason", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:20-23:20" } } } }; // malformed
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 1320),
    sessionEndUpperAbs: absMinutes("2026-09-04", 1330),
    toleranceMinutes: 10,
  });
  assert.equal(r.tier, "invalid");
  assert.ok(r.reason);
});

test("resolveReturnFeasibility: a tiered (non-unverified) result also exposes each bound's basis, for binding-limit composition", () => {
  const venue = venueWithAccess({ transit: { band: "20-25m", rank: 1 } });
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } };
  const r = resolveReturnFeasibility(venue, {}, {
    bicycleWithYou: false, raining: false,
    sessionEndMidAbs: absMinutes("2026-09-04", 1320),
    sessionEndUpperAbs: absMinutes("2026-09-04", 1330),
    toleranceMinutes: 10,
  });
  assert.equal(r.basisMid, "last_departure");
  assert.equal(r.basisUpper, "last_departure");
});

test("overallTier: the worse of the two tiers wins, over robust > tight > shorter > unverified", () => {
  assert.equal(overallTier("robust", "robust"), "robust");
  assert.equal(overallTier("robust", "tight"), "tight");
  assert.equal(overallTier("tight", "shorter"), "shorter");
  assert.equal(overallTier("shorter", "unverified"), "unverified");
  assert.equal(overallTier("unverified", "robust"), "unverified"); // order-independent
});

// --- Return-transport: combineBindingLimit (the six-row table) -------------

test("combineBindingLimit: hours NONE means metrics are undefined regardless of the return side", () => {
  const r = combineBindingLimit("none", 30, { basis: "last_departure", lastDepartureAbs: 1000 });
  assert.deepEqual(r, { row: "hours_none" });
});

test("combineBindingLimit: finite close + finite last departure takes whichever is earlier", () => {
  const closeWins = combineBindingLimit({ type: "finite", value: 1000 }, 30, { basis: "last_departure", lastDepartureAbs: 2000 });
  assert.equal(closeWins.bindingConstraint, "venue_close");
  assert.equal(closeWins.bindingLimitAbs, 970); // 1000 - 30

  const departureWins = combineBindingLimit({ type: "finite", value: 3000 }, 30, { basis: "last_departure", lastDepartureAbs: 2000 });
  assert.equal(departureWins.bindingConstraint, "last_departure");
  assert.equal(departureWins.bindingLimitAbs, 2000);
});

test("combineBindingLimit: finite close + AT_LEAST(0) return (core_span/schedule_free) is bound by venue close alone", () => {
  const r = combineBindingLimit({ type: "finite", value: 1000 }, 30, { basis: "core_span" });
  assert.equal(r.bindingConstraint, "venue_close");
  assert.equal(r.bindingLimitAbs, 970);
});

test("combineBindingLimit: COVERED hours + finite last departure yields a FINITE binding limit, not UNDETERMINED", () => {
  const r = combineBindingLimit({ type: "COVERED" }, 30, { basis: "last_departure", lastDepartureAbs: 2000 });
  assert.equal(r.bindingConstraint, "last_departure");
  assert.equal(r.bindingLimitAbs, 2000);
});

test("combineBindingLimit: COVERED hours + AT_LEAST(0) return is the only row with no binding limit at all", () => {
  const r = combineBindingLimit({ type: "COVERED" }, 30, { basis: "schedule_free" });
  assert.equal(r.bindingConstraint, "none");
  assert.equal(r.bindingLimitAbs, undefined);
});

// --- Return-transport: resolveOverallFeasibility (end-to-end) --------------

test("resolveOverallFeasibility: hours-unknown short-circuits, the return side is never evaluated", () => {
  const venue = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07" });
  venue.access = tripwireReturnTransport(); // throws if admissibleReturnModes ever reads it
  const holidays = { "2026-08-31": { name: "Test Holiday" } };
  const r = resolveOverallFeasibility(venue, holidays, {
    ...BASE_PARAMS, bicycleWithYou: false, raining: false, returnToleranceMinutes: 10, cycleLatestMinutes: null,
  });
  assert.equal(r.tier, "hours-unknown");
});

test("resolveOverallFeasibility: return unverified composes to overall unverified, preserving the hours-only metrics unchanged", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29", validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: { transit: { band: "20-25m", rank: 1 } } }; // schedule-bound only, no return_transport data
  const params = {
    ...BASE_PARAMS, departureDate: "2026-08-31", leaveAtMinutes: 1200, travelMinutesMid: 0, travelMinutesUpper: 10,
    durationMinutes: 120, closingBufferMinutes: 0, toleranceMinutes: 15,
    bicycleWithYou: false, raining: false, returnToleranceMinutes: 10, cycleLatestMinutes: null,
  };
  const hoursOnly = resolveFeasibility(venue, {}, params);
  const r = resolveOverallFeasibility(venue, {}, params);
  assert.equal(r.tier, "unverified");
  assert.equal(r.metricsBasis, "hours_only");
  assert.equal(r.latestLeaveAt, hoursOnly.latestLeaveAt);
  assert.equal(r.surplusMid.kind, "at_least_0");
});

test("resolveOverallFeasibility: COVERED hours + finite last departure yields a FINITE latestLeaveAt, not UNDETERMINED", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29", validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: { transit: { band: "20-25m", rank: 1 } } };
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } }; // lo 1380
  const params = {
    ...BASE_PARAMS, departureDate: "2026-08-31", leaveAtMinutes: 1200, travelMinutesMid: 0, travelMinutesUpper: 10,
    durationMinutes: 120, closingBufferMinutes: 0, toleranceMinutes: 15,
    bicycleWithYou: false, raining: false, returnToleranceMinutes: 10, cycleLatestMinutes: null,
  };
  const r = resolveOverallFeasibility(venue, {}, params);
  assert.equal(r.tier, "robust");
  assert.equal(r.metricsBasis, "combined");
  assert.notEqual(r.latestLeaveAt, "UNDETERMINED");
  assert.equal(r.latestLeaveAt, absMinutes("2026-08-31", 1262)); // mid's last departure edge is the midpoint 1382, not lo (1380) - 120 (duration) - 0 (travel)
  assert.doesNotMatch(JSON.stringify(r, (_, v) => (v === Infinity ? "__INF__" : v)), /Infinity/);
});

test("resolveOverallFeasibility: an omitted returnToleranceMinutes preserves the RETURN_TOLERANCE_MINUTES default end-to-end", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29", validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: { transit: { band: "20-25m", rank: 1 } } };
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "23:00-23:05" } } } }; // mid edge 1382
  const params = {
    ...BASE_PARAMS, departureDate: "2026-08-31", leaveAtMinutes: 1200, travelMinutesMid: 0, travelMinutesUpper: 8,
    durationMinutes: 192, closingBufferMinutes: 0, toleranceMinutes: 15, // hours side: COVERED regardless, tolerance unused
    bicycleWithYou: false, raining: false, cycleLatestMinutes: null,
    // returnToleranceMinutes intentionally omitted
  };
  // sessionEndMid = 1200+192 = 1392 -> return margin_mid = 1382-1392 = -10 (exactly the default tolerance)
  // sessionEndUpper = 1208+192 = 1400 -> return margin_upper = 1380-1400 = -20 (not robust)
  const r = resolveOverallFeasibility(venue, {}, params);
  assert.equal(r.tier, "tight"); // hours robust (COVERED), return tight -> overall worse-of is tight
});

test("resolveOverallFeasibility: COVERED hours + AT_LEAST(0) return (core_span) is the only combination yielding UNDETERMINED", () => {
  const venue = makeVenue({
    validFrom: "2026-08-29", validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: { transit: { band: "20-25m", rank: 1 } } };
  const params = {
    ...BASE_PARAMS, departureDate: "2026-08-31", leaveAtMinutes: 600, travelMinutesMid: 0, travelMinutesUpper: 10,
    durationMinutes: 60, closingBufferMinutes: 0, toleranceMinutes: 15,
    bicycleWithYou: false, raining: false, returnToleranceMinutes: 10, cycleLatestMinutes: null,
  };
  const r = resolveOverallFeasibility(venue, {}, params);
  assert.equal(r.tier, "robust");
  assert.equal(r.metricsBasis, "combined");
  assert.equal(r.latestLeaveAt, "UNDETERMINED");
  assert.equal(r.surplusMid.kind, "at_least_0");
});

// --- Return-transport: validateReturnTransport (whole-file, standalone) ----

test("validateReturnTransport: no return_transport block at all stamps ok", () => {
  const status = validateReturnTransport({ v1: {} });
  assert.deepEqual(status, { v1: { state: "ok" } });
});

test("validateReturnTransport: a present-but-bandless entry stamps ok, never calling normaliseBand on an absent value", () => {
  const venuesMeta = { v1: { return_transport: { origin_a: { transit: { default: {} } } } } };
  const status = validateReturnTransport(venuesMeta);
  assert.deepEqual(status, { v1: { state: "ok" } });
});

test("validateReturnTransport: a malformed band anywhere (including under by_weekday) marks the venue invalid", () => {
  const venuesMeta = {
    v1: {
      return_transport: {
        origin_a: {
          transit: {
            default: { last_departure_band: "23:20-23:25" },
            by_weekday: { sun: { last_departure_band: "23:20-23:20" } }, // malformed
          },
        },
      },
    },
  };
  const status = validateReturnTransport(venuesMeta);
  assert.equal(status.v1.state, "invalid");
  assert.ok(status.v1.reason.includes("sun"));
});

test("validateReturnTransport: failures are per-venue — one malformed venue never affects another", () => {
  const venuesMeta = {
    v1: { return_transport: { origin_a: { transit: { default: { last_departure_band: "23:20-23:20" } } } } }, // malformed
    v2: { return_transport: { origin_a: { transit: { default: { last_departure_band: "23:20-23:25" } } } } }, // ok
  };
  const status = validateReturnTransport(venuesMeta);
  assert.equal(status.v1.state, "invalid");
  assert.equal(status.v2.state, "ok");
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

// --- resolveBusynessBand / resolveSeatConfidence (IMP-003) ------------------
//
// "2024-01-01" is a Monday (see the calendar-arithmetic tests above), so
// weekday "mon" fixtures anchor there. All fixtures use N=15, P=5,
// MIN_HISTOGRAM_HOURS=6 (resolveBusynessBand's defaults) unless noted.

test("resolveBusynessBand: peak takes precedence over busy when both conditions hold", () => {
  // 14 open hours (08:00-22:00), plus closed-hour zero-fill at 0-7/22-23 that
  // must be excluded from median/max/coverage (see the dedicated test below).
  const entries = [
    ...Array.from({ length: 8 }, (_, h) => ({ hour: h, busyness: 0 })),
    { hour: 8, busyness: 20 }, { hour: 9, busyness: 25 }, { hour: 10, busyness: 30 },
    { hour: 11, busyness: 35 }, { hour: 12, busyness: 90 }, { hour: 13, busyness: 85 },
    { hour: 14, busyness: 80 }, { hour: 15, busyness: 75 }, { hour: 16, busyness: 70 },
    { hour: 17, busyness: 65 }, { hour: 18, busyness: 60 }, { hour: 19, busyness: 55 },
    { hour: 20, busyness: 50 }, { hour: 21, busyness: 45 },
    { hour: 22, busyness: 0 }, { hour: 23, busyness: 0 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 1320 }, entries);
  // Hour 12 (median 57.5, delta 32.5 >= N=15 -> busy AND value 90 >= max-P=85 -> peak).
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 12 * 60));
  assert.equal(r.band, "peak");
});

test("resolveBusynessBand: closed-hour zero-fill buckets are excluded from median/max/coverage", () => {
  const entries = [
    ...Array.from({ length: 8 }, (_, h) => ({ hour: h, busyness: 0 })),
    { hour: 8, busyness: 20 }, { hour: 9, busyness: 25 }, { hour: 10, busyness: 30 },
    { hour: 11, busyness: 35 }, { hour: 12, busyness: 90 }, { hour: 13, busyness: 85 },
    { hour: 14, busyness: 80 }, { hour: 15, busyness: 75 }, { hour: 16, busyness: 70 },
    { hour: 17, busyness: 65 }, { hour: 18, busyness: 60 }, { hour: 19, busyness: 55 },
    { hour: 20, busyness: 50 }, { hour: 21, busyness: 45 },
    { hour: 22, busyness: 0 }, { hour: 23, busyness: 0 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 1320 }, entries);
  // Hour 15 (value 75): delta 17.5 >= N -> busy; 75 < max-P=85 -> not peak.
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 15 * 60));
  assert.equal(r.band, "busy");
  // If the 16 closed-hour zeros had leaked in, the median/max would be
  // dragged toward 0 instead of 57.5/90, and coverage would read 30 not 14.
  assert.equal(r.medianUsed, 57.5);
  assert.equal(r.coverageHours, 14);
});

test("resolveBusynessBand: N boundary — delta exactly N is busy, one point short is typical", () => {
  // 8 open hours (08:00-16:00); a flat baseline of 50 keeps the median at 50
  // regardless of the one varied hour, and a fixed far-away peak (hour 15:100)
  // keeps every tested value well clear of the peak threshold (max-P=95).
  const flat = (busynessAtHour13) => [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: busynessAtHour13 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 100 },
  ];
  const period = { open: 480, close: 960 };
  const arrivalAbs = absMinutes("2024-01-01", 13 * 60);

  const busy = resolveBusynessBand(busynessVenue("mon", period, flat(65)), arrivalAbs);
  assert.equal(busy.medianUsed, 50);
  assert.equal(busy.delta, 15);
  assert.equal(busy.band, "busy");

  const typical = resolveBusynessBand(busynessVenue("mon", period, flat(64)), arrivalAbs);
  assert.equal(typical.delta, 14);
  assert.equal(typical.band, "typical");
});

test("resolveBusynessBand: P boundary — within P of max is peak, one point further is busy", () => {
  const flat = (busynessAtHour13) => [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: busynessAtHour13 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 100 },
  ];
  const period = { open: 480, close: 960 };
  const arrivalAbs = absMinutes("2024-01-01", 13 * 60);

  // max is fixed at 100 (hour 15); max - P = 95.
  const peak = resolveBusynessBand(busynessVenue("mon", period, flat(95)), arrivalAbs);
  assert.equal(peak.band, "peak");

  const busy = resolveBusynessBand(busynessVenue("mon", period, flat(94)), arrivalAbs);
  assert.equal(busy.band, "busy"); // delta 44 >= N=15, but not within P of max
});

test("resolveBusynessBand: a flat curve lands wholly in typical", () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({ hour: 8 + i, busyness: 50 }));
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  for (let h = 8; h < 16; h++) {
    const r = resolveBusynessBand(venue, absMinutes("2024-01-01", h * 60));
    assert.equal(r.band, "typical", `hour ${h}`);
    assert.equal(r.delta, 0);
  }
});

test("resolveBusynessBand: coverage below MIN_HISTOGRAM_HOURS yields unknown", () => {
  // Only 3 open hours (08:00-11:00) — below the default floor of 6.
  const entries = [
    { hour: 8, busyness: 40 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 60 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 660 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 9 * 60));
  assert.equal(r.band, "unknown");
  assert.equal(r.reason, "insufficient_coverage");
  assert.equal(r.coverageHours, 3);
});

test("resolveBusynessBand: no histogram at all for the weekday yields unknown", () => {
  const venue = makeVenue({
    validFrom: "2099-01-01",
    validThrough: "2099-01-07",
    regular: { mon: known([{ open: 480, close: 1320 }]) },
  });
  // venue.popularTimes is entirely absent.
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 12 * 60));
  assert.equal(r.band, "unknown");
});

test("resolveBusynessBand: adequate coverage elsewhere but a missing arrival-hour bucket yields unknown", () => {
  // 8 open hours (08:00-16:00) meet the floor, but hour 12's own bucket is
  // absent from the data — a real gap, not a closed-hour artifact.
  const entries = [8, 9, 10, 11, 13, 14, 15].map((h) => ({ hour: h, busyness: 50 }));
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 12 * 60));
  assert.equal(r.band, "unknown");
  assert.equal(r.reason, "no_data");
});

test("resolveBusynessBand: flooring — an arrival mid-hour reads that hour's own bucket, never the next", () => {
  const entries = [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 },
    { hour: 10, busyness: 90 }, // delta 40 and within P of max -> peak
    { hour: 11, busyness: 10 }, // delta -40 -> quiet
    { hour: 12, busyness: 50 }, { hour: 13, busyness: 50 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 50 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const at = (h, m) => absMinutes("2024-01-01", h * 60 + m);

  assert.equal(resolveBusynessBand(venue, at(10, 25)).band, "peak");
  assert.equal(resolveBusynessBand(venue, at(10, 59)).band, "peak");
  assert.equal(resolveBusynessBand(venue, at(11, 0)).band, "quiet");
});

// --- resolveBusynessBand: malformed and duplicate hours (IMP-003-R1-F01) ---
//
// All fixtures below share the same 8 open hours (08:00-16:00) and the same
// "flat 50 + one real outlier at hour 15:100" baseline used in the N/P
// boundary tests above, so a clean 8-hour set has median 50, max 100. Every
// test here corrupts exactly one hour's data and asserts the corruption is
// excluded rather than silently accepted.

test("resolveBusynessBand: a non-finite arrival-hour value never yields a determined band", () => {
  const entries = [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: undefined },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: 50 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 100 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 10 * 60));
  // Before the fix this read {band: "typical", delta: NaN} — a corrupted
  // arrival value must never produce a determined band, per plan.md's
  // "source failure must not invent conditions."
  assert.equal(r.band, "unknown");
  assert.equal(r.reason, "no_data");
  // The other 7 hours are still valid and countable — only the corrupted
  // hour itself is dropped.
  assert.equal(r.coverageHours, 7);
});

test("resolveBusynessBand: an out-of-range value elsewhere is excluded, not just ignored by luck", () => {
  // hour 14 carries 150 — a numeric but out-of-range (>100) reading. If it
  // leaked into the max/median computation it would corrupt both (wrongly
  // becoming the new max instead of hour 15's real 100).
  const entries = [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: 50 },
    { hour: 14, busyness: 150 }, { hour: 15, busyness: 100 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 10 * 60));
  assert.equal(r.coverageHours, 7); // hour 14 excluded, not counted
  assert.equal(r.medianUsed, 50);
  assert.equal(r.band, "typical"); // delta 0; would differ if 150 were the max
});

test("resolveBusynessBand: a negative value is malformed, same as an out-of-range positive one", () => {
  const entries = [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: -5 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 100 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 10 * 60));
  assert.equal(r.coverageHours, 7); // hour 13 excluded
});

test("resolveBusynessBand: exact 0 and 100 are valid readings, never treated as malformed", () => {
  // A falsy-but-valid busyness of 0 must survive a naive `if (!value)` bug.
  const entries = [
    { hour: 8, busyness: 0 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: 50 },
    { hour: 14, busyness: 50 }, { hour: 15, busyness: 100 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 8 * 60));
  assert.equal(r.coverageHours, 8); // all 8 hours counted, including the 0
  assert.notEqual(r.band, "unknown");
  assert.equal(r.band, "quiet"); // 0 is far below the median
});

test("resolveBusynessBand: duplicate records for one hour drop coverage below the floor, exactly the case that would otherwise satisfy it", () => {
  // Six raw records, all for the SAME hour — meets the raw-count floor of 6
  // but reflects only one (contested) hourly bucket, never six.
  const entries = Array.from({ length: 6 }, () => ({ hour: 10, busyness: 90 }));
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 10 * 60));
  // Before the fix this read {band: "typical", coverageHours: 6}.
  assert.equal(r.band, "unknown");
  assert.equal(r.reason, "insufficient_coverage");
  assert.equal(r.coverageHours, 0); // the contested hour counts for nothing
});

test("resolveBusynessBand: a duplicate record for a non-arrival hour is excluded without corrupting the other hours' stats", () => {
  // hour 14 has two conflicting raw records (50 and 999) — both must be
  // dropped, neither counted, and the surviving 7 hours must compute exactly
  // as if hour 14 had never appeared at all.
  const entries = [
    { hour: 8, busyness: 50 }, { hour: 9, busyness: 50 }, { hour: 10, busyness: 50 },
    { hour: 11, busyness: 50 }, { hour: 12, busyness: 50 }, { hour: 13, busyness: 50 },
    { hour: 14, busyness: 50 }, { hour: 14, busyness: 999 }, { hour: 15, busyness: 100 },
  ];
  const venue = busynessVenue("mon", { open: 480, close: 960 }, entries);
  const r = resolveBusynessBand(venue, absMinutes("2024-01-01", 10 * 60));
  assert.equal(r.coverageHours, 7); // 8 nominal hours minus the excluded duplicate
  assert.equal(r.medianUsed, 50);
  assert.equal(r.band, "typical");
});

test("resolveSeatConfidence: full baseline x band lookup matches the explicit table, clamped at both ends", () => {
  const LADDER = { poor: 1, mixed: 2, usually_available: 3, dependable: 4 };
  const REVERSE = { 1: "poor", 2: "mixed", 3: "usually_available", 4: "dependable" };
  const ADJUSTMENT = { quiet: 1, typical: 0, busy: -1, peak: -2 };
  for (const baseline of Object.keys(LADDER)) {
    for (const band of Object.keys(ADJUSTMENT)) {
      const level = Math.min(4, Math.max(1, LADDER[baseline] + ADJUSTMENT[band]));
      const r = resolveSeatConfidence(baseline, { band });
      assert.equal(r.confidence, REVERSE[level], `${baseline} + ${band}`);
      assert.equal(r.evidenceQuality, "normal", `${baseline} + ${band}`);
    }
  }
});

test("resolveSeatConfidence: an unknown baseline always yields unknown confidence, regardless of band", () => {
  for (const band of ["quiet", "typical", "busy", "peak", "unknown"]) {
    const r = resolveSeatConfidence("unknown", { band });
    assert.equal(r.confidence, "unknown");
    assert.equal(r.evidenceQuality, "normal");
  }
});

test("resolveSeatConfidence: unknown busyness leaves baseline confidence unchanged, evidence flagged weak", () => {
  const r = resolveSeatConfidence("usually_available", { band: "unknown" });
  assert.equal(r.confidence, "usually_available");
  assert.equal(r.evidenceQuality, "weak");
});

test("resolveSeatConfidence: a determined band always yields evidenceQuality normal", () => {
  for (const band of ["quiet", "typical", "busy", "peak"]) {
    const r = resolveSeatConfidence("mixed", { band });
    assert.equal(r.evidenceQuality, "normal");
  }
});

// --- resolveFeasibilityAtArrivals: independently-resolved arrivals ---------

test("resolveFeasibilityAtArrivals: mid and upper are resolved on their own dates, never derived from one shared departure", () => {
  // Monday 20:00-24:00 open; Tuesday closed entirely (default). Passing a
  // Monday mid arrival and a Tuesday upper arrival proves each bound reads
  // its own date's hours rather than one departure abs plus two travel
  // estimates, which could never land upper on a different weekday than mid
  // unless the two arrivals are genuinely independent inputs.
  const venue = makeVenue({
    validFrom: "2099-01-01", validThrough: "2099-01-07",
    regular: { mon: known([{ open: 1200, close: 1440 }]) },
  });
  const arrivalMidAbs = absMinutes("2024-01-01", 1260); // Monday 21:00, inside the open period
  const arrivalUpperAbs = absMinutes("2024-01-02", 1260); // Tuesday 21:00, Tuesday is closed
  const r = resolveFeasibilityAtArrivals(venue, {}, {
    arrivalMidAbs, arrivalUpperAbs, travelMinutesMid: 0, travelMinutesUpper: 0,
    durationMinutes: 60, closingBufferMinutes: 0, toleranceMinutes: 15,
  });
  assert.equal(r.tier, "tight"); // mid fits with 120m slack; upper is NONE so robust is impossible
  assert.equal(r.usableMinutesMid, 60);
  assert.deepEqual(r.surplusMid, { kind: "finite", minutes: 120 });
  assert.equal(r.surplusUpper, undefined); // upper NONE never unranks on its own, but has no surplus
});

// --- resolvePlanBArrivals: the dual-bound arrival chain ---------------------

test("resolvePlanBArrivals: departures come from Plan A's own arrivals plus the seat-check buffer, arrivals add the fallback's own travel bound", () => {
  const r = resolvePlanBArrivals({
    planAArrivalMidAbs: 1000, planAArrivalUpperAbs: 1050,
    fallbackTravelMinutesMid: 20, fallbackTravelMinutesUpper: 30,
    seatCheckBufferMinutes: 10,
  });
  assert.deepEqual(r, {
    departureMidAbs: 1010, departureUpperAbs: 1060,
    arrivalMidAbs: 1030, arrivalUpperAbs: 1090,
  });
});

test("resolvePlanBArrivals: seatCheckBufferMinutes defaults to the provisional 10 when omitted", () => {
  const withDefault = resolvePlanBArrivals({
    planAArrivalMidAbs: 1000, planAArrivalUpperAbs: 1000,
    fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
  });
  const explicit10 = resolvePlanBArrivals({
    planAArrivalMidAbs: 1000, planAArrivalUpperAbs: 1000,
    fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    seatCheckBufferMinutes: 10,
  });
  assert.deepEqual(withDefault, explicit10);
});

// --- meetsConfidenceFloor ----------------------------------------------------

test("meetsConfidenceFloor: a confidence at or above the floor clears it, below does not, unknown never clears any floor", () => {
  assert.equal(meetsConfidenceFloor("dependable", "mixed"), true);
  assert.equal(meetsConfidenceFloor("mixed", "mixed"), true); // at the floor, not just above
  assert.equal(meetsConfidenceFloor("poor", "mixed"), false);
  assert.equal(meetsConfidenceFloor("unknown", "mixed"), false);
});

// --- resolveBackupStrength: the strong/salvage/none grading table ----------

test("resolveBackupStrength: strong when the session fits (robust or tight) and confidence clears the floor", () => {
  assert.equal(resolveBackupStrength({ overallTier: "robust", confidence: "dependable", usableMinutesMid: 180, minSessionMinutes: 90, minConfidence: "mixed" }).strength, "strong");
  assert.equal(resolveBackupStrength({ overallTier: "tight", confidence: "usually_available", usableMinutesMid: 170, minSessionMinutes: 90, minConfidence: "mixed" }).strength, "strong");
});

test("resolveBackupStrength: salvage when the floor is cleared but the requested session does not fit", () => {
  const r = resolveBackupStrength({ overallTier: "shorter", confidence: "mixed", usableMinutesMid: 90, minSessionMinutes: 90, minConfidence: "mixed" });
  assert.equal(r.strength, "salvage");
  assert.equal(r.reason, "short_session");
});

test("resolveBackupStrength: none when the return-capped minutes fall below PLAN_B_MIN_SESSION_MINUTES", () => {
  const r = resolveBackupStrength({ overallTier: "shorter", confidence: "mixed", usableMinutesMid: 89, minSessionMinutes: 90, minConfidence: "mixed" });
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "below_minimum_minutes");
});

test("resolveBackupStrength: an unverified return caps backup_strength at salvage, never strong, and is labelled as such", () => {
  const r = resolveBackupStrength({ overallTier: "unverified", confidence: "mixed", usableMinutesMid: 200, minSessionMinutes: 90, minConfidence: "mixed" });
  assert.equal(r.strength, "salvage");
  assert.equal(r.reason, "unverified_return");
});

test("resolveBackupStrength: confidence below the floor is none even when the session fits on hours and return alone", () => {
  const poor = resolveBackupStrength({ overallTier: "robust", confidence: "poor", usableMinutesMid: 180, minSessionMinutes: 90, minConfidence: "mixed" });
  assert.equal(poor.strength, "none");
  assert.equal(poor.reason, "confidence_below_floor");
  const unknown = resolveBackupStrength({ overallTier: "robust", confidence: "unknown", usableMinutesMid: 180, minSessionMinutes: 90, minConfidence: "mixed" });
  assert.equal(unknown.strength, "none");
  assert.equal(unknown.reason, "confidence_below_floor");
});

// --- evaluatePlanBFallback: end-to-end ---------------------------------------

function planBFallbackVenue({ regular, baseline, mode = "walk" }) {
  const v = makeVenue({ validFrom: "2099-01-01", validThrough: "2099-01-07", regular });
  v.access = { origin_a: { [mode]: {} } };
  v.baseline_seatability = baseline;
  return v;
}

const PLAN_B_BASE = {
  bicycleWithYou: false, raining: false,
  durationMinutes: 180, closingBufferMinutes: 0, toleranceMinutes: 15,
  returnToleranceMinutes: 10, cycleLatestMinutes: null,
};

test("evaluatePlanBFallback: strong when the requested session fits and confidence clears the floor", () => {
  const venue = planBFallbackVenue({ regular: { mon: known([{ open: 0, always_open: true }]) }, baseline: "dependable" });
  const planAArrivalMidAbs = absMinutes("2024-01-01", 1200);
  const planAArrivalUpperAbs = absMinutes("2024-01-01", 1210);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 5, fallbackTravelMinutesUpper: 10,
    planAArrivalMidAbs, planAArrivalUpperAbs,
  });
  assert.equal(r.strength, "strong");
  assert.equal(r.overallTier, "robust");
  assert.equal(r.planBArrivalMidAbs, planAArrivalMidAbs + 10 + 5); // seat-check buffer (10) + travel (5)
  assert.equal(r.planBArrivalUpperAbs, planAArrivalUpperAbs + 10 + 10);
});

test("evaluatePlanBFallback: salvage when the floor is cleared but the requested session does not fit", () => {
  const venue = planBFallbackVenue({ regular: { mon: known([{ open: 1200, close: 1330 }]) }, baseline: "usually_available" });
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10, // -10 for the seat-check buffer, landing exactly at open
  });
  assert.equal(r.overallTier, "shorter");
  assert.equal(r.usableMinutesMid, 130); // open 1200, close 1330, arrival 1200 -> 130 usable of the requested 180
  assert.equal(r.strength, "salvage");
  assert.equal(r.reason, "short_session");
});

test("evaluatePlanBFallback: none when even the return-capped minutes fall below the salvage floor", () => {
  const venue = planBFallbackVenue({ regular: { mon: known([{ open: 1200, close: 1250 }]) }, baseline: "usually_available" });
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.usableMinutesMid, 50); // open 1200, close 1250 -> only 50 minutes available
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "below_minimum_minutes");
});

test("evaluatePlanBFallback: an unverified return caps backup_strength at salvage, labelled as an unverified way home rather than a short session", () => {
  const venue = makeVenue({
    validFrom: "2099-01-01", validThrough: "2099-01-07",
    regular: { mon: known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: {} }; // no recorded route home at all
  venue.baseline_seatability = "mixed";
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.overallTier, "unverified");
  assert.equal(r.usableMinutesMid, 180); // hours-only metrics: always-open, full requested duration
  assert.equal(r.metricsBasis, "hours_only"); // never presentable as a committed/return-capped duration
  assert.equal(r.strength, "salvage");
  assert.equal(r.reason, "unverified_return");
});

// IMP-004-R1-F01: an unverified return has no return-capped usable_minutes to
// clear the floor with. Without the fix, this fixture's 110 hours-only
// minutes (>= PLAN_B_MIN_SESSION_MINUTES) would have wrongly qualified as
// salvage even though the session does not fit by hours alone AND the way
// home is unknown — two independent reasons for caution, neither honestly
// measurable, compounding into a false "salvage" claim with no real basis.
test("evaluatePlanBFallback: hours-only minutes clearing the floor never grant salvage when the fallback's own hours tier is shorter and the return is unverified", () => {
  const venue = planBFallbackVenue({ regular: { mon: known([{ open: 1200, close: 1310 }]) }, baseline: "usually_available" });
  venue.access = { origin_a: {} }; // no recorded route home at all -> unverified
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.overallTier, "unverified");
  assert.equal(r.usableMinutesMid, 110); // open 1200, close 1310 -> 110 hours-only minutes, >= the 90 floor
  assert.equal(r.strength, "none"); // the fallback's own hours tier is "shorter" (110 < the requested 180), never salvage on an unverified return
  assert.equal(r.reason, "unverified_return_and_short_session");
});

test("evaluatePlanBFallback: a cycle-mode fallback link is unviable without the bicycle, and no hours or return data is ever read", () => {
  const tripwireVenue = {
    get hours() { throw new Error("tripwire: hours should never be read for an unviable cycle fallback"); },
    get access() { throw new Error("tripwire: access should never be read for an unviable cycle fallback"); },
    get baseline_seatability() { throw new Error("tripwire: baseline_seatability should never be read"); },
  };
  const r = evaluatePlanBFallback(tripwireVenue, {}, {
    ...PLAN_B_BASE, fallbackMode: "cycle", fallbackTravelMinutesMid: 10, fallbackTravelMinutesUpper: 15,
    planAArrivalMidAbs: 1000, planAArrivalUpperAbs: 1050,
  });
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "cycle_fallback_unviable");
});

test("evaluatePlanBFallback: confidence below the floor is none even when the session fits", () => {
  const venue = planBFallbackVenue({ regular: { mon: known([{ open: 0, always_open: true }]) }, baseline: "poor" });
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.overallTier, "robust");
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "confidence_below_floor");
});

test("evaluatePlanBFallback: an hours-unknown fallback venue is never a Plan B option", () => {
  const venue = planBFallbackVenue({ regular: { mon: unknown() }, baseline: "dependable" });
  const arrivalAbs = absMinutes("2024-01-01", 1200);
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "hours-unknown");
});

test("evaluatePlanBFallback: the salvage/none floor reads the return-capped usable minutes, never the hours-capped duration", () => {
  // Always-open venue (hours alone would give the full 180m duration), but a
  // real last-departure constraint caps the return-side usable time to well
  // under PLAN_B_MIN_SESSION_MINUTES. If the floor check ever read the raw
  // duration instead of the return-capped usableMinutesMid, this would
  // wrongly read "salvage" (or better) instead of "none".
  const venue = makeVenue({
    validFrom: "2099-01-01", validThrough: "2099-01-07",
    regular: { mon: known([{ open: 0, always_open: true }]) },
  });
  venue.access = { origin_a: { transit: {} } }; // schedule-bound only, no schedule-free mode
  venue.return_transport = { origin_a: { transit: { default: { last_departure_band: "21:40-21:50" } } } }; // mid edge 1305
  venue.baseline_seatability = "dependable";
  const arrivalAbs = absMinutes("2024-01-01", 1250); // 20:50 -> session end 23:50 (1430), past the core span and evening pre-dawn window
  const r = evaluatePlanBFallback(venue, {}, {
    ...PLAN_B_BASE, fallbackMode: "walk", fallbackTravelMinutesMid: 0, fallbackTravelMinutesUpper: 0,
    planAArrivalMidAbs: arrivalAbs - 10, planAArrivalUpperAbs: arrivalAbs - 10,
  });
  assert.equal(r.overallTier, "shorter");
  assert.equal(r.usableMinutesMid, 55); // last departure 1305 - arrival 1250, never the raw 180m duration
  assert.equal(r.strength, "none");
  assert.equal(r.reason, "below_minimum_minutes");
});

// --- rankVenues: the whole-dataset entry point ------------------------------

/** A complete venue for rankVenues tests. Defaults to an always-open Monday
 * venue, reachable by walk (schedule-free, so the return leg is "robust" by
 * positive evidence with no return_transport data needed at all), dependable
 * baseline, no popularTimes (busyness "unknown" via insufficient coverage) —
 * the "everything about this venue is fine" baseline every taxonomy-row test
 * starts from and overrides exactly one thing. */
function fullVenue(overrides = {}) {
  const {
    id,
    preference = 1,
    area = "Test Area",
    baseline = "dependable",
    businessStatus = "OPERATIONAL",
    access = { origin_a: { walk: { band: "5-10m", rank: 1 } } },
    returnStatus = { state: "ok" },
    validFrom = "2099-01-01",
    validThrough = "2099-01-07",
    byDate = {},
    regular = { mon: known([{ open: 0, always_open: true }]) },
    popularTimes = {},
    fallbacks = [],
    wetWeatherMode,
    closingBufferMinutes = 0,
    returnTransport,
    holidayReturnPolicy,
  } = overrides;
  const v = makeVenue({ validFrom, validThrough, byDate, regular });
  Object.assign(v, {
    id,
    preference,
    area,
    baseline_seatability: baseline,
    business_status: businessStatus,
    access,
    return_transport_status: returnStatus,
    popularTimes,
    fallbacks,
    closing_buffer_minutes: closingBufferMinutes,
  });
  if (wetWeatherMode) v.wet_weather_mode = wetWeatherMode;
  if (returnTransport) v.return_transport = returnTransport;
  if (holidayReturnPolicy) v.holiday_return_policy = holidayReturnPolicy;
  return v;
}

const BASE_CONTROLS = {
  origin: "origin_a",
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

function findCandidate(result, id) {
  return [...result.groups.ranked, ...result.groups.shorter, ...result.groups.unverified].find((c) => c.venueId === id);
}

// --- resolveOutboundMode ------------------------------------------------

test("resolveOutboundMode: returns the requested mode unchanged when not raining", () => {
  const venue = fullVenue({ id: "v1", wetWeatherMode: { origin_a: { cycle: "transit" } } });
  assert.equal(resolveOutboundMode(venue, "origin_a", "cycle", false), "cycle");
});

test("resolveOutboundMode: substitutes the recorded mode when raining", () => {
  const venue = fullVenue({ id: "v1", wetWeatherMode: { origin_a: { cycle: "transit" } } });
  assert.equal(resolveOutboundMode(venue, "origin_a", "cycle", true), "transit");
});

test("resolveOutboundMode: a mode with no recorded substitute is returned unchanged when raining", () => {
  const venue = fullVenue({ id: "v1", wetWeatherMode: { origin_a: { cycle: "transit" } } });
  assert.equal(resolveOutboundMode(venue, "origin_a", "walk", true), "walk");
});

// --- validatePreferenceSnapshot ------------------------------------------

test("validatePreferenceSnapshot: every venue with a valid, unique preference is absent from the result", () => {
  const venues = [fullVenue({ id: "a", preference: 1 }), fullVenue({ id: "b", preference: 2 })];
  const invalid = validatePreferenceSnapshot(venues);
  assert.equal(invalid.size, 0);
});

test("validatePreferenceSnapshot: a missing or non-integer preference fails that venue only", () => {
  const missingPreference = fullVenue({ id: "a" });
  delete missingPreference.preference; // "undefined" as an override would fall through to the fixture's own default
  const venues = [
    missingPreference,
    fullVenue({ id: "b", preference: 1.5 }),
    fullVenue({ id: "c", preference: 2 }),
  ];
  const invalid = validatePreferenceSnapshot(venues);
  assert.ok(invalid.has("a"));
  assert.ok(invalid.has("b"));
  assert.ok(!invalid.has("c"));
});

test("validatePreferenceSnapshot: a duplicated preference value fails every venue sharing it, not a third venue with a unique value", () => {
  const venues = [
    fullVenue({ id: "a", preference: 3 }),
    fullVenue({ id: "b", preference: 3 }),
    fullVenue({ id: "c", preference: 4 }),
  ];
  const invalid = validatePreferenceSnapshot(venues);
  assert.ok(invalid.has("a"));
  assert.ok(invalid.has("b"));
  assert.ok(!invalid.has("c"));
});

// --- rankVenues: the ranked/unranked taxonomy, one test per row ------------

test("taxonomy: overall_tier robust or tight lands in the main ranked group", () => {
  const venues = [fullVenue({ id: "v1" })]; // always-open, walk access -> robust
  const r = rankVenues({ venues, holidays: {} }, BASE_CONTROLS);
  assert.equal(r.groups.ranked.length, 1);
  assert.equal(r.groups.ranked[0].venueId, "v1");
  assert.equal(r.groups.ranked[0].tier, "robust");
});

test("taxonomy: overall_tier shorter lands in its own group", () => {
  const venues = [fullVenue({ id: "v1", regular: { mon: known([{ open: 0, close: 60 }]) } })]; // far too little open time
  const r = rankVenues({ venues, holidays: {} }, BASE_CONTROLS);
  assert.equal(r.groups.shorter.length, 1);
  assert.equal(r.groups.shorter[0].venueId, "v1");
  assert.equal(r.groups.ranked.length, 0);
});

test("taxonomy: overall_tier unverified is ranked in its own group, but barred from Plan A", () => {
  const venues = [
    fullVenue({
      id: "v1",
      access: { origin_a: { transit: { band: "5-10m", rank: 1 } } }, // schedule-bound only
    }),
  ];
  // leave at 20:00 + 7m travel (floor((5+10)/2)) + 180m duration -> session
  // ends 23:07, outside the core span (07:00-21:30) and the pre-dawn gap,
  // with no return_transport data recorded at all -> unverified.
  const controls = { ...BASE_CONTROLS, mode: "transit", leaveAtMinutes: 1200 };
  const r = rankVenues({ venues, holidays: {} }, controls);
  assert.equal(r.groups.unverified.length, 1);
  assert.equal(r.groups.unverified[0].venueId, "v1");
  assert.equal(r.groups.unverified[0].tier, "unverified");
  assert.equal(r.groups.ranked.length, 0);
  assert.equal(r.groups.shorter.length, 0);
  assert.equal(r.planA, null); // the only candidate is unverified, so there is no Plan A
});

test("taxonomy: an access entry of explicit null is unranked in its own travel-time-unknown group", () => {
  const venues = [fullVenue({ id: "v1", access: { origin_a: { walk: null } } })];
  const r = rankVenues({ venues, holidays: {} }, BASE_CONTROLS);
  assert.deepEqual(r.travelUnknown, [{ venueId: "v1" }]);
  assert.equal(findCandidate(r, "v1"), undefined);
  assert.equal(r.removed.find((x) => x.venueId === "v1"), undefined);
});

test("taxonomy: a missing access[origin][mode] key is hard-filtered — not a candidate anywhere, not even travel-unknown", () => {
  const venues = [fullVenue({ id: "v1", access: { origin_a: {} } })];
  const r = rankVenues({ venues, holidays: {} }, BASE_CONTROLS);
  assert.equal(r.travelUnknown.length, 0);
  assert.equal(r.removed.length, 0);
  assert.equal(findCandidate(r, "v1"), undefined);
});

test("taxonomy: return_transport_status absent or not ok is an unranked removal with a visible diagnostic", () => {
  const absentVenue = fullVenue({ id: "absent", preference: 1 });
  delete absentVenue.return_transport_status; // "undefined" as an override would fall through to the fixture's own default
  const venues = [
    absentVenue,
    fullVenue({ id: "invalid", preference: 2, returnStatus: { state: "invalid", reason: "malformed band" } }),
  ];
  const r = rankVenues({ venues, holidays: {} }, BASE_CONTROLS);
  const absent = r.removed.find((x) => x.venueId === "absent");
  const invalid = r.removed.find((x) => x.venueId === "invalid");
  assert.ok(absent && absent.kind === "return_data_broken");
  assert.ok(invalid && invalid.kind === "return_data_broken");
  assert.equal(findCandidate(r, "absent"), undefined);
  assert.equal(findCandidate(r, "invalid"), undefined);
});

// IMP-010 pre-gate finding: plan.md's ownership order runs travel-band
// parsing (step 3) before return-status STEP 0 removal (step 4). When a
// venue carries both a malformed access band and a broken return status, the
// diagnostic must name the access-band defect, not the return-status one.
test("taxonomy: a malformed access band is diagnosed even when return_transport_status is also broken, per the stated step order", () => {
  const venue = fullVenue({
    id: "v1",
    access: { origin_a: { walk: { band: "not-a-band", rank: 1 } } },
    returnStatus: { state: "invalid", reason: "malformed band" },
  });
  const r = rankVenues({ venues: [venue], holidays: {} }, BASE_CONTROLS);
  const removed = r.removed.find((x) => x.venueId === "v1");
  assert.ok(removed);
  assert.equal(removed.kind, "access_band_invalid");
});

test("taxonomy: hours UNKNOWN is an unranked removal, distinct from closed", () => {
  // BASE_CONTROLS departs 2024-01-01, outside this venue's (far-future)
  // current-hours window, so a holiday on that date resolves via the
  // holiday_unknown authority before regular_hours is ever consulted.
  const venue = fullVenue({ id: "v1" });
  const r = rankVenues({ venues: [venue], holidays: { "2024-01-01": { name: "Test Holiday" } } }, BASE_CONTROLS);
  const removed = r.removed.find((x) => x.venueId === "v1");
  assert.ok(removed && removed.kind === "hours_unknown");
  assert.equal(findCandidate(r, "v1"), undefined);
});

test("taxonomy: contradictory hours (disagreeing matching periods) is an unranked validation failure", () => {
  const venue = fullVenue({
    id: "v1",
    regular: {
      mon: known([
        { open: 0, close: 700 },
        { open: 0, close: 800 }, // both match arrival 600, disagreeing on period_end_abs
      ]),
    },
  });
  const r = rankVenues({ venues: [venue], holidays: {} }, BASE_CONTROLS);
  const removed = r.removed.find((x) => x.venueId === "v1");
  assert.ok(removed && removed.kind === "contradictory_hours");
  assert.equal(findCandidate(r, "v1"), undefined);
});

test("taxonomy: an upper-bound NONE is ranked, failing robust while the midpoint still evaluates to tight", () => {
  const venue = fullVenue({
    id: "v1",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 925 }]) }, // open only through 15:25
    access: { origin_a: { walk: { band: "10-30m", rank: 1 } } }, // mid=20, upper=30
  });
  const controls = {
    ...BASE_CONTROLS,
    departureDate: "2026-08-31",
    leaveAtMinutes: 900, // mid arrival 920 (inside), upper arrival 930 (NONE, >= 925)
    durationMinutes: 1,
    toleranceMinutes: 15,
  };
  const r = rankVenues({ venues: [venue], holidays: {} }, controls);
  const c = findCandidate(r, "v1");
  assert.ok(c);
  assert.equal(c.tier, "tight");
});

test("taxonomy: a midpoint NONE cannot be tight and falls to the shorter group", () => {
  const venue = fullVenue({
    id: "v1",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": closed() },
  });
  const r = rankVenues({ venues: [venue], holidays: {} }, { ...BASE_CONTROLS, departureDate: "2026-08-31" });
  const c = findCandidate(r, "v1");
  assert.ok(c);
  assert.equal(c.tier, "shorter");
  assert.equal(r.removed.find((x) => x.venueId === "v1"), undefined); // ranked, not removed
});

test("taxonomy: neither bound having an active period is still ranked, as shorter", () => {
  const venue = fullVenue({
    id: "v1",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": closed() }, // both mid and upper arrivals land on a closed date
  });
  const r = rankVenues({ venues: [venue], holidays: {} }, { ...BASE_CONTROLS, departureDate: "2026-08-31" });
  assert.equal(r.groups.shorter.length, 1);
  assert.equal(r.groups.ranked.length, 0);
});

test("taxonomy: a missing or malformed preference is an unranked removal, that venue only", () => {
  const good = fullVenue({ id: "good", preference: 1 });
  const bad = fullVenue({ id: "bad" });
  delete bad.preference; // "undefined" as an override would fall through to the fixture's own default
  const r = rankVenues({ venues: [good, bad], holidays: {} }, BASE_CONTROLS);
  const removed = r.removed.find((x) => x.venueId === "bad");
  assert.ok(removed && removed.kind === "preference_invalid");
  assert.equal(findCandidate(r, "good").venueId, "good");
  assert.equal(findCandidate(r, "bad"), undefined);
});

test("taxonomy: a preference value duplicated across venues removes every venue carrying it", () => {
  const a = fullVenue({ id: "a", preference: 5 });
  const b = fullVenue({ id: "b", preference: 5 });
  const c = fullVenue({ id: "c", preference: 6 });
  const r = rankVenues({ venues: [a, b, c], holidays: {} }, BASE_CONTROLS);
  assert.ok(r.removed.find((x) => x.venueId === "a" && x.kind === "preference_invalid"));
  assert.ok(r.removed.find((x) => x.venueId === "b" && x.kind === "preference_invalid"));
  assert.equal(findCandidate(r, "c").venueId, "c");
});

test("taxonomy: a non-OPERATIONAL venue is an unranked removal in its own notice naming the business_status", () => {
  const venue = fullVenue({ id: "v1", businessStatus: "CLOSED_PERMANENTLY" });
  const r = rankVenues({ venues: [venue], holidays: {} }, BASE_CONTROLS);
  const removed = r.removed.find((x) => x.venueId === "v1");
  assert.ok(removed && removed.kind === "not_operational");
  assert.match(removed.reason, /CLOSED_PERMANENTLY/);
});

// --- rankVenues: the 8-key ranking order ------------------------------------

test("ranking order: overall_tier decides first — robust beats tight regardless of every later key", () => {
  const robust = fullVenue({ id: "robust", preference: 99, baseline: "poor" });
  const tight = fullVenue({
    id: "tight",
    preference: 1,
    baseline: "dependable",
    validFrom: "2026-08-29",
    validThrough: "2026-09-04",
    byDate: { "2026-08-31": known([{ open: 0, close: 925 }]) },
    access: { origin_a: { walk: { band: "10-30m", rank: 1 } } }, // mid=20, upper=30 -> upper NONE at close 925
  });
  const controls = { ...BASE_CONTROLS, departureDate: "2026-08-31", leaveAtMinutes: 900, durationMinutes: 1 };
  // robust venue evaluated on the same date needs its own always-open regular hours, unaffected by tight's byDate override (different venue objects).
  const r = rankVenues({ venues: [tight, robust], holidays: {} }, controls);
  assert.equal(r.planA.venueId, "robust");
  assert.deepEqual(r.groups.ranked.map((c) => c.venueId), ["robust", "tight"]);
});

test("ranking order: within equal tiers, seat_confidence decides next", () => {
  const strong = fullVenue({ id: "strong", preference: 1, baseline: "dependable" });
  const weak = fullVenue({ id: "weak", preference: 2, baseline: "poor" });
  const r = rankVenues({ venues: [weak, strong], holidays: {} }, BASE_CONTROLS);
  assert.deepEqual(r.groups.ranked.map((c) => c.venueId), ["strong", "weak"]);
});

test("ranking order: within equal tier and confidence, backup_strength decides next", () => {
  const withFallback = fullVenue({
    id: "with-fallback",
    preference: 1,
    fallbacks: [{ venue_id: "fb", mode: "walk", travel_band: "1-3m" }],
  });
  const withoutFallback = fullVenue({ id: "without-fallback", preference: 2 });
  const fb = fullVenue({ id: "fb", preference: 3, baseline: "dependable" });
  const r = rankVenues({ venues: [withoutFallback, withFallback, fb], holidays: {} }, BASE_CONTROLS);
  const withFb = findCandidate(r, "with-fallback");
  const withoutFb = findCandidate(r, "without-fallback");
  assert.equal(withFb.backupStrength, "strong");
  assert.equal(withoutFb.backupStrength, "none");
  const order = r.groups.ranked.map((c) => c.venueId).filter((id) => id !== "fb");
  assert.deepEqual(order, ["with-fallback", "without-fallback"]);
});

test("ranking order: within equal tier/confidence/backup_strength, less travel burden wins", () => {
  const near = fullVenue({ id: "near", preference: 1, access: { origin_a: { walk: { band: "1-3m", rank: 1 } } } });
  const far = fullVenue({ id: "far", preference: 2, access: { origin_a: { walk: { band: "20-30m", rank: 1 } } } });
  const r = rankVenues({ venues: [far, near], holidays: {} }, BASE_CONTROLS);
  assert.deepEqual(r.groups.ranked.map((c) => c.venueId), ["near", "far"]);
});

test("ranking order: preference decides once tier/confidence/backup/travel all tie, lower number first", () => {
  const preferred = fullVenue({ id: "preferred", preference: 1 });
  const lessPreferred = fullVenue({ id: "less-preferred", preference: 2 });
  const r = rankVenues({ venues: [lessPreferred, preferred], holidays: {} }, BASE_CONTROLS);
  assert.deepEqual(r.groups.ranked.map((c) => c.venueId), ["preferred", "less-preferred"]);
});

test("ranking order: surplus_mid is the final tiebreak, through surplusSortKey only", () => {
  // Two venues tied on every earlier key (same tier/confidence/backup/travel/
  // preference is impossible without duplicating preference, which would
  // trip snapshot validation — so this proves the comparator reaches surplus
  // by giving both venues distinct preference values that happen to compare
  // in the OPPOSITE direction of their surplus, and asserting surplus lost
  // to preference (preference is a higher key), then isolating surplus with
  // preference held constant is not possible under the strict-total-order
  // rule. Instead: assert surplusSortKey is actually consulted by giving one
  // venue AT_LEAST_0 (an unproven margin) and the other a real, larger
  // proven surplus, with preference tied via two venues in different areas
  // is not needed — same preference is disallowed, so this test targets
  // surplusSortKey's tag-safety directly instead.
  assert.equal(surplusSortKey(AT_LEAST_0), 0);
  assert.equal(surplusSortKey(finiteSurplus(50)) > surplusSortKey(AT_LEAST_0), true);
});

// --- rankVenues: fallback selection (7-key order) ---------------------------

test("fallback selection: among several fallback links, the one with the best backup_strength wins", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [
      { venue_id: "weak-fallback", mode: "walk", travel_band: "1-3m" },
      { venue_id: "strong-fallback", mode: "walk", travel_band: "1-3m" },
    ],
  });
  const weakFallback = fullVenue({ id: "weak-fallback", preference: 2, baseline: "poor" }); // confidence below the floor -> none
  const strongFallback = fullVenue({ id: "strong-fallback", preference: 3, baseline: "dependable" }); // -> strong
  const r = rankVenues({ venues: [primary, weakFallback, strongFallback], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "primary");
  assert.equal(c.backupStrength, "strong");
  assert.equal(c.planB.venueId, "strong-fallback");
});

// IMP-010 pre-gate finding: a fallback venue is still a venue — plan.md's
// taxonomy states a non-OPERATIONAL venue is "never Plan A or Plan B", and
// STEP 0's return-status precondition is a fact about the venue, not about
// the primary-candidate path alone. Without the fix, selectPlanBFallback
// read the fallback straight from the unfiltered venue map and evaluated it
// with neither gate applied.
test("fallback selection: a non-OPERATIONAL fallback venue is never selected as Plan B", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [{ venue_id: "closed-fallback", mode: "walk", travel_band: "1-3m" }],
  });
  const closedFallback = fullVenue({ id: "closed-fallback", preference: 2, baseline: "dependable", businessStatus: "CLOSED_PERMANENTLY" });
  const r = rankVenues({ venues: [primary, closedFallback], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "primary");
  assert.equal(c.backupStrength, "none");
  assert.equal(c.planB, null);
});

test("fallback selection: a fallback venue with a broken or absent return_transport_status is never selected as Plan B", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [{ venue_id: "broken-return-fallback", mode: "walk", travel_band: "1-3m" }],
  });
  const brokenReturnFallback = fullVenue({
    id: "broken-return-fallback",
    preference: 2,
    baseline: "dependable",
    returnStatus: { state: "invalid", reason: "malformed band" },
  });
  const r = rankVenues({ venues: [primary, brokenReturnFallback], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "primary");
  assert.equal(c.backupStrength, "none");
  assert.equal(c.planB, null);

  const absentReturnFallback = fullVenue({ id: "broken-return-fallback", preference: 2, baseline: "dependable" });
  delete absentReturnFallback.return_transport_status;
  const r2 = rankVenues({ venues: [primary, absentReturnFallback], holidays: {} }, BASE_CONTROLS);
  const c2 = findCandidate(r2, "primary");
  assert.equal(c2.backupStrength, "none");
  assert.equal(c2.planB, null);
});

// IMP-010-R1-F01 (Codex review correction): the whole-dataset `preference`
// invariant applies to fallback venues too, before any ordering key —
// including compareFallbacks' own preference comparison and its undocumented
// venue_id fallthrough — ever reads it. Without the fix, selectPlanBFallback
// read fallback venues straight from the unfiltered venueById map: with two
// equal-strength fallbacks and compareFallbacks falling through to venue_id
// whenever a preference is undefined, the invalid-preference fallback
// ("bad-a") won the tiebreak over the valid one ("good-z") purely by name.
test("fallback selection: a fallback venue with a missing preference is excluded, never winning even the undocumented venue_id tiebreak", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [
      { venue_id: "bad-a", mode: "walk", travel_band: "1-3m" },
      { venue_id: "good-z", mode: "walk", travel_band: "1-3m" },
    ],
  });
  const badFallback = fullVenue({ id: "bad-a", baseline: "dependable" });
  delete badFallback.preference; // "undefined" as an override would fall through to the fixture's own default
  const goodFallback = fullVenue({ id: "good-z", preference: 2, baseline: "dependable" });
  const r = rankVenues({ venues: [primary, badFallback, goodFallback], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "primary");
  assert.equal(c.backupStrength, "strong");
  assert.equal(c.planB.venueId, "good-z");
});

// A duplicated preference is a subtler case: compareFallbacks' preference
// comparison itself reads the raw (invalid) values without knowing they were
// invalidated by a duplicate elsewhere in the snapshot, so "dup-a" (9) would
// beat "unique-b" (10) on that comparison alone. Only excluding it from
// `evaluated` entirely — not merely deprioritising it — fixes this.
test("fallback selection: a fallback venue with a preference duplicated against another venue is excluded, not merely deprioritised", () => {
  const primary = fullVenue({
    id: "primary",
    preference: 1,
    fallbacks: [
      { venue_id: "dup-a", mode: "walk", travel_band: "1-3m" },
      { venue_id: "unique-b", mode: "walk", travel_band: "1-3m" },
    ],
  });
  const dupFallback = fullVenue({ id: "dup-a", preference: 9, baseline: "dependable" });
  const elsewhereDup = fullVenue({ id: "elsewhere", preference: 9 }); // shares dup-a's preference, invalidating both
  const uniqueFallback = fullVenue({ id: "unique-b", preference: 10, baseline: "dependable" });
  const r = rankVenues({ venues: [primary, dupFallback, elsewhereDup, uniqueFallback], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "primary");
  assert.equal(c.backupStrength, "strong");
  assert.equal(c.planB.venueId, "unique-b");
});

// --- rankVenues: refusals ----------------------------------------------------

test("refusals: no candidate reaching mixed confidence yields noLowRiskOption, distinct from the return refusal", () => {
  const venue = fullVenue({ id: "v1", baseline: "poor" });
  const r = rankVenues({ venues: [venue], holidays: {} }, BASE_CONTROLS);
  assert.equal(r.refusals.noLowRiskOption, true);
  assert.equal(r.refusals.noVerifiedReturn, null);
});

test("refusals: every qualifying candidate being unverified yields noVerifiedReturn with the session end time", () => {
  const venue = fullVenue({
    id: "v1",
    baseline: "dependable",
    access: { origin_a: { transit: { band: "5-10m", rank: 1 } } },
  });
  const controls = { ...BASE_CONTROLS, mode: "transit", leaveAtMinutes: 1200 }; // ends 23:07, no return data -> unverified
  const r = rankVenues({ venues: [venue], holidays: {} }, controls);
  assert.equal(r.refusals.noLowRiskOption, false); // confidence is fine — this is specifically the return refusal
  assert.equal(r.refusals.noVerifiedReturn, "23:07");
});

// --- rankVenues: area grouping -----------------------------------------------

test("alternatives are grouped by area, excluding Plan A, order preserved within each group", () => {
  const planAVenue = fullVenue({ id: "plan-a", area: "North", preference: 1 });
  const altSameArea = fullVenue({ id: "alt-north", area: "North", preference: 2, baseline: "usually_available" });
  const altOtherArea = fullVenue({ id: "alt-south", area: "South", preference: 3, baseline: "usually_available" });
  const r = rankVenues({ venues: [planAVenue, altSameArea, altOtherArea], holidays: {} }, BASE_CONTROLS);
  assert.equal(r.planA.venueId, "plan-a");
  assert.deepEqual(r.alternatives.North.map((c) => c.venueId), ["alt-north"]);
  assert.deepEqual(r.alternatives.South.map((c) => c.venueId), ["alt-south"]);
  assert.equal(r.alternatives.North.some((c) => c.venueId === "plan-a"), false);
});

// --- rankVenues: control resolution (wet_weather_mode) ----------------------

test("control resolution: raining substitutes the outbound mode and its access band per venue", () => {
  const venue = fullVenue({
    id: "v1",
    access: {
      origin_a: {
        cycle: { band: "5-10m", rank: 1 },
        transit: { band: "20-30m", rank: 2 },
      },
    },
    wetWeatherMode: { origin_a: { cycle: "transit" } },
  });
  const dry = rankVenues({ venues: [venue], holidays: {} }, { ...BASE_CONTROLS, mode: "cycle", raining: false });
  const wet = rankVenues({ venues: [venue], holidays: {} }, { ...BASE_CONTROLS, mode: "cycle", raining: true });
  assert.equal(findCandidate(dry, "v1").travelMinutesMid, 7); // floor((5+10)/2)
  assert.equal(findCandidate(wet, "v1").travelMinutesMid, 25); // floor((20+30)/2), via the transit substitute
});

// --- rankVenues: candidate display fields (IMP-012-R1-F01) -----------------
//
// PLAN.md:1754 / 2263-2265 require every ranked row — Plan A and every
// alternative — to show both feasibility tiers, the overall tier, the
// binding constraint, the return mode(s) relied on, and latest_leave_at,
// not just the composed overall tier. These prove the candidate object
// actually carries those facts (app.js only formats them), across the three
// binding-limit shapes a candidate can land in.

test("rankVenues candidate: schedule-free return exposes hoursTier/returnTier/bindingConstraint/returnBasis/returnModes/latestLeaveAt", () => {
  const venue = fullVenue({ id: "v1" }); // always-open Monday, walk access (schedule-free)
  const r = rankVenues({ venues: [venue], holidays: {} }, BASE_CONTROLS);
  const c = findCandidate(r, "v1");
  assert.equal(c.hoursTier, "robust"); // always_open -> COVERED
  assert.equal(c.returnTier, "robust"); // schedule-free settles it as positive evidence
  assert.equal(c.tier, "robust");
  assert.equal(c.bindingConstraint, "none"); // COVERED hours + AT_LEAST(0) return -> no binding limit
  assert.equal(c.returnBasis, "schedule_free");
  assert.deepEqual(c.returnModes, ["walk"]);
  assert.equal(c.latestLeaveAt, "UNDETERMINED");
});

test("rankVenues candidate: a finite last-departure return names the binding constraint and mode, with a finite latestLeaveAt", () => {
  const venue = fullVenue({
    id: "v1",
    access: { origin_a: { transit: { band: "5-10m", rank: 1 } } },
    returnTransport: { origin_a: { transit: { default: { last_departure_band: "23:20-23:25" } } } },
  });
  // leaveAt 20:00 + ~7m travel + 180m duration -> session end ~23:07, past the
  // core span (21:30), so this genuinely exercises the timetable lookup.
  const controls = { ...BASE_CONTROLS, mode: "transit", leaveAtMinutes: 1200, durationMinutes: 180 };
  const r = rankVenues({ venues: [venue], holidays: {} }, controls);
  const c = findCandidate(r, "v1");
  assert.equal(c.hoursTier, "robust"); // always_open -> COVERED
  assert.equal(c.returnTier, "robust");
  assert.equal(c.bindingConstraint, "last_departure"); // COVERED hours + finite last departure
  assert.equal(c.returnBasis, "last_departure");
  assert.deepEqual(c.returnModes, ["transit"]);
  assert.equal(typeof c.latestLeaveAt, "number");
});

// IMP-012-R1-F01 round 2: the hours side of an unverified-return candidate is
// not always a real closing constraint — a 24/7 (COVERED) venue has none at
// all, and labelling it "venue_close" contradicts latestLeaveAt's own
// "UNDETERMINED" ("no known closing constraint within the verified span") on
// the very same candidate. These two tests hold the *return* side fixed
// (unverified, no data) and vary only the *hours* side, so the fix must read
// hoursResult's own outcome rather than assuming one label for every case.

test("rankVenues candidate: an unverified return over 24/7 hours reports no binding constraint at all, never venue_close", () => {
  const venue = fullVenue({
    id: "v1",
    access: { origin_a: { transit: { band: "5-10m", rank: 1 } } }, // schedule-bound, no return_transport data at all
    // regular hours default to fullVenue's always-open Monday — COVERED, no real close.
  });
  const controls = { ...BASE_CONTROLS, mode: "transit", leaveAtMinutes: 1200, durationMinutes: 180 }; // ends past the core span, no return data
  const r = rankVenues({ venues: [venue], holidays: {} }, controls);
  const c = findCandidate(r, "v1");
  assert.equal(c.hoursTier, "robust");
  assert.equal(c.returnTier, "unverified");
  assert.equal(c.tier, "unverified"); // worse-of robust and unverified
  assert.equal(c.metricsBasis, "hours_only");
  assert.equal(c.latestLeaveAt, "UNDETERMINED"); // COVERED — no close was reached within the verified span
  assert.equal(c.bindingConstraint, "none"); // must not contradict the UNDETERMINED latestLeaveAt above
});

test("rankVenues candidate: an unverified return over a finite-hours venue correctly names venue_close", () => {
  const venue = fullVenue({
    id: "v1",
    access: { origin_a: { transit: { band: "5-10m", rank: 1 } } }, // schedule-bound, no return_transport data at all
    regular: { mon: known([{ open: 480, close: 1320 }]) }, // 08:00-22:00, a genuine same-day close
  });
  // leaveAt 21:00 + ~7m travel + 35m duration -> arrives 21:07, ends 21:42,
  // past the core span (21:30) so the return leg genuinely goes unverified;
  // still well inside the 08:00-22:00 window so the hours side is a real
  // finite close, not COVERED.
  const controls = { ...BASE_CONTROLS, mode: "transit", leaveAtMinutes: 1260, durationMinutes: 35 };
  const r = rankVenues({ venues: [venue], holidays: {} }, controls);
  const c = findCandidate(r, "v1");
  assert.equal(c.hoursTier, "robust");
  assert.equal(c.returnTier, "unverified");
  assert.equal(c.metricsBasis, "hours_only");
  assert.notEqual(c.latestLeaveAt, "UNDETERMINED");
  assert.equal(typeof c.latestLeaveAt, "number"); // a genuine finite closing-derived leave-by time
  assert.equal(c.bindingConstraint, "venue_close"); // the real constraint here, correctly distinguished from the COVERED case above
});
