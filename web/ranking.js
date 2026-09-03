// Pure hours-resolution and feasibility-tier logic. No DOM, no fetch, no imports.
//
// Every date in this module is a plain "YYYY-MM-DD" string representing an
// Asia/Singapore calendar date — never a real-world timestamp. Day arithmetic
// is done with Date.UTC() purely as an opaque calendar-math trick (never
// converting an actual timezone), so there is no DST or offset bug possible:
// we never touch a real moment in time, only calendar dates and integer
// minutes-from-midnight offsets. See plan.md's "Time, dates and hours
// resolution" section and CLAUDE.md's hours-resolution contract for the full
// specification this file implements.

const MINUTES_PER_DAY = 1440;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Return-transport constants (plan.md's "Getting home" section). The core
// span and service-day boundary are maintained/structural, not provisional,
// so they stay bare module constants; the tolerance and cycle cutoff are
// provisional per plan.md's own table and are threaded as overridable
// parameters wherever they're used, defaulting to these values.
const RETURN_CORE_FROM_MINUTES = 420; // 07:00 — maintained assumption
const RETURN_CORE_UNTIL_MINUTES = 1290; // 21:30 — maintained assumption
const RETURN_SERVICE_DAY_START_MINUTES = 240; // 04:00 — structural
const RETURN_TOLERANCE_MINUTES = 10; // provisional; distinct from resolveFeasibility's toleranceMinutes
const RETURN_CYCLE_LATEST_MINUTES = null; // provisional; null = no limit (open policy question)

// relative_busyness / seat_confidence constants (plan.md's decision-model
// section). N and P were measured from real Phase 0 curves (decisions.md,
// 2026-08-29); MIN_HISTOGRAM_HOURS is provisional but confirmed generous
// against real coverage. All three are threaded as overridable parameters,
// like the return-transport constants above.
const BUSYNESS_N = 15;
const BUSYNESS_P = 5;
const MIN_HISTOGRAM_HOURS = 6;

// Plan B / backup_strength constants (plan.md's "Plan B viability floor" and
// "5. backup_strength"). All three are provisional and threaded as
// overridable parameters, like the constants above.
const SEAT_CHECK_BUFFER_MINUTES = 10;
const PLAN_B_MIN_SESSION_MINUTES = 90;
const PLAN_B_MIN_CONFIDENCE = "mixed";

// --- Calendar-date arithmetic -----------------------------------------

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function dayNumber(dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function formatDate(dayNum) {
  const ms = dayNum * 86400000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr, n) {
  return formatDate(dayNumber(dateStr) + n);
}

export function weekdayAbbrev(dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** abs(date, offset) = days_since_epoch(date) * 1440 + offset. Offsets are
 * for storage; absolute minutes are for arithmetic — see plan.md. */
export function absMinutes(dateStr, offsetMinutes) {
  return dayNumber(dateStr) * MINUTES_PER_DAY + offsetMinutes;
}

export function dateFromAbs(abs) {
  return formatDate(Math.floor(abs / MINUTES_PER_DAY));
}

/** period_end_abs(d, p) = UNBOUNDED if p.always_open, else abs(d, p.close).
 * UNBOUNDED is a runtime-only value (Infinity) — it is never serialised and
 * never itself a feasibility result; see effectiveClose. */
export function periodEndAbs(dateStr, period) {
  return period.always_open ? Infinity : absMinutes(dateStr, period.close);
}

/** service_date(t) = date(t - RETURN_SERVICE_DAY_START_MINUTES). A night's
 * return-transport belongs to the calendar date it started on, not the one it
 * ends on — a 03:30 Saturday session tests against Friday night's last
 * departure. See plan.md's "Getting home" section. */
export function serviceDateFromAbs(abs) {
  return dateFromAbs(abs - RETURN_SERVICE_DAY_START_MINUTES);
}

/** The offset-from-midnight component of an absolute minute — always in
 * [0, 1440) by construction. Used for the return-transport core-span/pre-dawn
 * clock checks, which compare against calendar midnight, not the service day. */
export function clockMinutesOfDay(abs) {
  return abs - absMinutes(dateFromAbs(abs), 0);
}

// --- Return-transport: band parsing --------------------------------------

/**
 * normaliseEdge("HH:MM") -> offset|null. Parses a clock string into
 * minutes-from-midnight, then shifts anything before the service-day start
 * into the next day's numbering, so "00:30" -> 1470, never 30. Every valid
 * clock string lands in [RETURN_SERVICE_DAY_START_MINUTES, 1680).
 */
export function normaliseEdge(hhmm) {
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const raw = hh * 60 + mm;
  return raw < RETURN_SERVICE_DAY_START_MINUTES ? raw + MINUTES_PER_DAY : raw;
}

/**
 * normaliseBand("HH:MM-HH:MM") -> {kind:"present", lo, hi} | {kind:"malformed", reason}.
 * Both edges are normalised BEFORE the lo<hi check — this order is what lets
 * "23:55-00:05" (a midnight-straddling band) pass while "03:58-04:02" (a
 * band straddling the service-day boundary itself, naming two different
 * nights) fails via this same check, with no extra rule needed.
 */
export function normaliseBand(band) {
  const parts = typeof band === "string" ? band.split("-") : [];
  if (parts.length !== 2) {
    return { kind: "malformed", reason: `expected "HH:MM-HH:MM", got ${JSON.stringify(band)}` };
  }
  const lo = normaliseEdge(parts[0]);
  const hi = normaliseEdge(parts[1]);
  if (lo === null || hi === null) {
    return { kind: "malformed", reason: `unparseable edge in "${band}"` };
  }
  if (!(lo < hi)) {
    return { kind: "malformed", reason: `edges not increasing after normalisation: (${lo}, ${hi})` };
  }
  return { kind: "present", lo, hi };
}

/**
 * lastDepartureEdge(band, boundKind) -> number. The return leg's pessimism
 * convention is the mirror of a travel band's: the upper bound takes the
 * EARLIER edge (the earliest the last departure might really be), and the
 * mid bound takes the floored midpoint. Never merge this with a travel
 * band's own edge selection, which takes its upper edge for the upper bound.
 */
export function lastDepartureEdge(band, boundKind) {
  return boundKind === "upper" ? band.lo : Math.floor((band.lo + band.hi) / 2);
}

// --- Travel-band parsing (access[][].band, fallbacks[].travel_band) -------

/**
 * normaliseTravelBand("N-Mm") -> {kind:"present", mid, upper}
 *                               | {kind:"not_measured"}
 *                               | {kind:"malformed", reason}
 *
 * `mid` is the floored midpoint (mirrors lastDepartureEdge's floored mid);
 * `upper` is the band's upper edge — the pessimistic bound for feasibility,
 * the opposite convention from a return band's upper bound, which takes the
 * LOWER edge. Never merge the two.
 *
 * `null` means "not yet measured" (access[][].band's explicit-null case) and
 * is a distinct outcome from "malformed" — a caller for which null is never
 * legitimate (e.g. a fallbacks[].travel_band entry, which is always added
 * complete) must reject `not_measured` itself; this function only reports
 * what the value means, not whether it's acceptable in a given context.
 */
/** Best-effort description of an unparseable value for a diagnostic message.
 * JSON.stringify throws on a BigInt and on any value with a throwing
 * toJSON(), which would turn a malformed-input rejection into an uncaught
 * throw — exactly the failure mode a fail-closed parser must not have. */
function describeUnparseable(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return `<unserialisable ${typeof value}>`;
  }
}

export function normaliseTravelBand(band) {
  if (band === null) return { kind: "not_measured" };
  const m = typeof band === "string" ? /^([0-9]+)-([0-9]+)m$/.exec(band) : null;
  if (!m) {
    return { kind: "malformed", reason: `expected "N-Mm", got ${describeUnparseable(band)}` };
  }
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) {
    return { kind: "malformed", reason: `edge outside the safe integer range: (${m[1]}, ${m[2]})` };
  }
  if (!(lo < hi)) {
    return { kind: "malformed", reason: `edges not increasing: (${lo}, ${hi})` };
  }
  return { kind: "present", mid: Math.floor((lo + hi) / 2), upper: hi };
}

// --- resolve_return_service -----------------------------------------------

/**
 * resolveReturnService(venue, holidays, destination, mode, serviceDate)
 *   -> {kind:"missing"} | {kind:"malformed", reason} | {kind:"present", lo, hi}
 *
 * Precedence: holiday policy -> by_weekday -> default -> missing. The
 * weekday consulted is the SERVICE date's weekday, never the session-end
 * date's. holiday_return_policy "unknown" (the default) returns missing on a
 * holiday even when a default entry exists — it never silently falls
 * through to by_weekday/default. normaliseBand is only ever called on an
 * entry that actually has a last_departure_band; calling it on an absent
 * entry would fabricate a validation failure out of ordinary missing data.
 */
export function resolveReturnService(venue, holidays, destination, mode, serviceDate) {
  const block = venue.return_transport?.[destination]?.[mode];
  if (!block) return { kind: "missing" };

  let entry;
  if (holidays && Object.prototype.hasOwnProperty.call(holidays, serviceDate)) {
    if (venue.holiday_return_policy === "substitute_sun") {
      entry = block.by_weekday?.sun ?? block.default;
    } else {
      return { kind: "missing" };
    }
  } else {
    const targetWeekday = weekdayAbbrev(serviceDate);
    entry =
      block.by_weekday && Object.prototype.hasOwnProperty.call(block.by_weekday, targetWeekday)
        ? block.by_weekday[targetWeekday]
        : block.default;
  }

  if (!entry || !entry.last_departure_band) return { kind: "missing" };

  const r = normaliseBand(entry.last_departure_band);
  return r.kind === "malformed" ? { kind: "malformed", reason: r.reason } : { kind: "present", lo: r.lo, hi: r.hi };
}

// --- Admissible return modes -----------------------------------------------

/**
 * admissibleReturnModes(venue, bicycleWithYou, raining, sessionEndAbs, serviceDate, cycleLatestMinutes)
 *   -> Set<mode>
 *
 * A total function of only its explicit parameters (session_end_abs and
 * service_date included) — it must be independently callable per bound so
 * mid and upper can land on different admissible sets. Always evaluated
 * against access[origin_a]: the return leg is evaluated against the
 * outbound-home access, never the outbound origin of the trip being made.
 * An empty result is meaningful (no recorded way home) and must never be
 * silently defaulted to non-empty.
 */
export function admissibleReturnModes(
  venue,
  bicycleWithYou,
  raining,
  sessionEndAbs,
  serviceDate,
  cycleLatestMinutes = RETURN_CYCLE_LATEST_MINUTES
) {
  const destAccess = venue.access?.origin_a ?? {};
  const modes = new Set(Object.keys(destAccess).filter((m) => destAccess[m] != null));
  if (!bicycleWithYou) modes.delete("cycle");
  if (raining) modes.delete("cycle");
  if (cycleLatestMinutes !== null) {
    const cutoffAbs = absMinutes(serviceDate, cycleLatestMinutes);
    if (sessionEndAbs > cutoffAbs) modes.delete("cycle");
  }
  return modes;
}

// --- Evaluating one return bound --------------------------------------------

const SCHEDULE_FREE_MODES = new Set(["walk", "cycle"]);

/**
 * resolveReturnBound(venue, holidays, bicycleWithYou, raining, sessionEndAbs, boundKind, cycleLatestMinutes)
 *   -> {kind:"unverified", basis} | {kind:"validation_failure", reason}
 *      | {kind:"pass", basis, margin, lastDepartureAbs?}
 *
 * Step order is load-bearing and must not be reordered:
 *   1. The route prerequisite — unconditional, every hour, checked first.
 *      No clock, no span, no default may supply a route that was never
 *      recorded. Fires even inside the core span.
 *   2. A schedule-free admissible mode settles it immediately — no
 *      return_transport read at all.
 *   3. Inside the core span, the TIMETABLE is waived, never the route (step
 *      1 already proved a route exists). Zero return_transport reads.
 *   4. The pre-dawn gap, terminal on a schedule-bound-only set: last night's
 *      service has finished and this morning's has not started, so nothing
 *      is looked up.
 *   5. Only now is return_transport read at all.
 *   6. MAX (not MIN) over admissible modes' last departures — independent
 *      real services, not a decomposed encoding of one fact.
 */
export function resolveReturnBound(
  venue,
  holidays,
  bicycleWithYou,
  raining,
  sessionEndAbs,
  boundKind,
  cycleLatestMinutes = RETURN_CYCLE_LATEST_MINUTES
) {
  const serviceDate = serviceDateFromAbs(sessionEndAbs);
  const clock = clockMinutesOfDay(sessionEndAbs);

  const modes = admissibleReturnModes(venue, bicycleWithYou, raining, sessionEndAbs, serviceDate, cycleLatestMinutes);
  if (modes.size === 0) return { kind: "unverified", basis: "no_recorded_route", modes: [] };

  const scheduleFreeModes = [...modes].filter((m) => SCHEDULE_FREE_MODES.has(m));
  if (scheduleFreeModes.length > 0) {
    // Display-only: which mode(s) actually settle it, not the whole admissible
    // set — a schedule-bound mode sharing the set isn't why this passed.
    return { kind: "pass", basis: "schedule_free", margin: AT_LEAST_0, modes: scheduleFreeModes };
  }

  if (clock >= RETURN_CORE_FROM_MINUTES && clock <= RETURN_CORE_UNTIL_MINUTES) {
    // Every admissible mode works equally here — the span waives the
    // timetable lookup regardless of which one is used.
    return { kind: "pass", basis: "core_span", margin: AT_LEAST_0, modes: [...modes] };
  }

  if (clock >= RETURN_SERVICE_DAY_START_MINUTES && clock < RETURN_CORE_FROM_MINUTES) {
    return { kind: "unverified", basis: "pre_dawn_gap", modes: [...modes] };
  }

  const resolved = [...modes].map((m) => ({ mode: m, result: resolveReturnService(venue, holidays, "origin_a", m, serviceDate) }));
  const malformed = resolved.find((r) => r.result.kind === "malformed");
  if (malformed) return { kind: "validation_failure", reason: malformed.result.reason };

  const present = resolved.filter((r) => r.result.kind === "present");
  if (present.length === 0) return { kind: "unverified", basis: "no_data", modes: [...modes] };

  const departures = present.map((r) => ({
    mode: r.mode,
    abs: absMinutes(serviceDate, lastDepartureEdge(r.result, boundKind)),
  }));
  const lastDepartureAbs = Math.max(...departures.map((d) => d.abs));
  // Display-only: the mode(s) whose own last departure is the binding one —
  // MAX over independent real services, so a tie legitimately names more
  // than one (docstring above, step 6).
  const modesRelied = departures.filter((d) => d.abs === lastDepartureAbs).map((d) => d.mode);
  return {
    kind: "pass",
    basis: "last_departure",
    margin: finiteSurplus(lastDepartureAbs - sessionEndAbs),
    lastDepartureAbs,
    modes: modesRelied,
  };
}

// --- Return tier and overall_tier composition -------------------------------

/**
 * resolveReturnFeasibility(venue, holidays, returnParams) -> {tier, ...}
 *
 *   invalid    : either bound returned validation_failure (checked first)
 *   unverified : either bound returned unverified
 *   robust     : passesFeasibility(returnMarginUpper)
 *   tight      : not robust AND (passesFeasibility(returnMarginMid)
 *                OR finiteShortfall(returnMarginMid) <= toleranceMinutes)
 *   shorter    : otherwise
 *
 * returnMargin_* reuse the existing AT_LEAST_0/finiteSurplus tagged type
 * unchanged — passesFeasibility/finiteShortfall are shared with the hours
 * side without modification.
 */
export function resolveReturnFeasibility(venue, holidays, returnParams) {
  const {
    bicycleWithYou,
    raining,
    sessionEndMidAbs,
    sessionEndUpperAbs,
    toleranceMinutes = RETURN_TOLERANCE_MINUTES,
    cycleLatestMinutes,
  } = returnParams;

  const mid = resolveReturnBound(venue, holidays, bicycleWithYou, raining, sessionEndMidAbs, "mid", cycleLatestMinutes);
  const upper = resolveReturnBound(venue, holidays, bicycleWithYou, raining, sessionEndUpperAbs, "upper", cycleLatestMinutes);

  if (mid.kind === "validation_failure" || upper.kind === "validation_failure") {
    return { tier: "invalid", reason: mid.kind === "validation_failure" ? mid.reason : upper.reason };
  }
  if (mid.kind === "unverified" || upper.kind === "unverified") {
    return { tier: "unverified", basisMid: mid.basis, basisUpper: upper.basis, modesMid: mid.modes, modesUpper: upper.modes };
  }

  const robust = passesFeasibility(upper.margin);
  const tight = !robust && (passesFeasibility(mid.margin) || finiteShortfall(mid.margin) <= toleranceMinutes);

  return {
    tier: robust ? "robust" : tight ? "tight" : "shorter",
    returnMarginMid: mid.margin,
    returnMarginUpper: upper.margin,
    lastDepartureAbsMid: mid.lastDepartureAbs,
    lastDepartureAbsUpper: upper.lastDepartureAbs,
    basisMid: mid.basis,
    basisUpper: upper.basis,
    modesMid: mid.modes,
    modesUpper: upper.modes,
  };
}

const RETURN_TIER_RANK = { unverified: 0, shorter: 1, tight: 2, robust: 3 };

/** overallTier(hoursTier, returnTier) -> the worse of the two, over the total
 * ordering robust > tight > shorter > unverified. Only called once both
 * sides are already known to be one of these four values — hours "invalid"/
 * "hours-unknown" and return "invalid" unrank the venue before this
 * composition is ever reached. */
export function overallTier(hoursTier, returnTier) {
  return RETURN_TIER_RANK[hoursTier] <= RETURN_TIER_RANK[returnTier] ? hoursTier : returnTier;
}

/**
 * combineBindingLimit(effectiveCloseRaw, closingBufferMinutes, returnOutcome)
 *   -> {row:"hours_none"} | {bindingConstraint, bindingLimitAbs}
 *
 * The six-row binding-limit table. Branches on tags before any arithmetic,
 * exactly like the hours side already does:
 *
 *   finite close  + finite last departure -> min(close-buffer, last_departure)
 *   finite close  + AT_LEAST(0) return    -> close-buffer alone
 *   COVERED       + finite last departure -> last_departure alone (FINITE)
 *   COVERED       + AT_LEAST(0) return    -> no binding limit (UNDETERMINED)
 *   NONE  (any return)                    -> metrics undefined
 *   UNKNOWN is never passed here — it unranks before this is reached.
 */
export function combineBindingLimit(effectiveCloseRaw, closingBufferMinutes, returnOutcome) {
  if (effectiveCloseRaw === "none") return { row: "hours_none" };

  const isLastDeparture = returnOutcome.basis === "last_departure";

  if (effectiveCloseRaw.type === "COVERED") {
    return isLastDeparture
      ? { bindingConstraint: "last_departure", bindingLimitAbs: returnOutcome.lastDepartureAbs }
      : { bindingConstraint: "none", bindingLimitAbs: undefined };
  }

  const closeAdjustedAbs = effectiveCloseRaw.value - closingBufferMinutes;
  if (!isLastDeparture) {
    return { bindingConstraint: "venue_close", bindingLimitAbs: closeAdjustedAbs };
  }
  return closeAdjustedAbs <= returnOutcome.lastDepartureAbs
    ? { bindingConstraint: "venue_close", bindingLimitAbs: closeAdjustedAbs }
    : { bindingConstraint: "last_departure", bindingLimitAbs: returnOutcome.lastDepartureAbs };
}

/** Per-bound combined metrics, mirroring resolveBound's own arithmetic but
 * reading bindingLimitAbs (never a raw effectiveClose a second time). Returns
 * undefined for a NONE bound (closed at arrival), matching resolveFeasibility's
 * own undefined-for-None convention. */
function boundBindingMetrics(venue, holidays, arrivalAbs, travelMinutes, durationMinutes, closingBufferMinutes, returnOutcome) {
  const active = findActivePeriod(venue, holidays, arrivalAbs);
  if (active.result !== "open") return undefined;

  const requiredEndAbs = arrivalAbs + durationMinutes + closingBufferMinutes;
  const ec = effectiveClose(venue, holidays, { date: active.date, period: active.period, authority: active.authority }, requiredEndAbs);
  const combined = combineBindingLimit(ec, closingBufferMinutes, returnOutcome);

  if (combined.bindingConstraint === "none") {
    return { usableMinutes: durationMinutes, surplus: AT_LEAST_0, latestLeaveAt: "UNDETERMINED", bindingConstraint: "none" };
  }
  const bindingLimitAbs = combined.bindingLimitAbs;
  const usableMinutes = Math.max(0, Math.min(bindingLimitAbs, arrivalAbs + durationMinutes) - arrivalAbs);
  const surplus = finiteSurplus(bindingLimitAbs - (arrivalAbs + durationMinutes));
  const latestLeaveAt = bindingLimitAbs - durationMinutes - travelMinutes;
  return { usableMinutes, surplus, latestLeaveAt, bindingConstraint: combined.bindingConstraint };
}

/**
 * resolveOverallFeasibility(venue, holidays, params) -> the composed result.
 *
 * Thin wrapper: derives both arrivals from one shared departure, then
 * delegates to resolveOverallFeasibilityAtArrivals for the actual
 * hours/return composition. See that function's own doc comment for the
 * composition rules.
 */
export function resolveOverallFeasibility(venue, holidays, params) {
  const {
    departureDate,
    leaveAtMinutes,
    travelMinutesMid,
    travelMinutesUpper,
    durationMinutes,
    closingBufferMinutes,
    toleranceMinutes,
    bicycleWithYou,
    raining,
    returnToleranceMinutes = RETURN_TOLERANCE_MINUTES,
    cycleLatestMinutes,
  } = params;

  const departureAbs = absMinutes(departureDate, leaveAtMinutes);
  const arrivalMidAbs = departureAbs + travelMinutesMid;
  const arrivalUpperAbs = departureAbs + travelMinutesUpper;

  return resolveOverallFeasibilityAtArrivals(venue, holidays, {
    arrivalMidAbs, arrivalUpperAbs, travelMinutesMid, travelMinutesUpper, durationMinutes, closingBufferMinutes, toleranceMinutes,
    bicycleWithYou, raining, returnToleranceMinutes, cycleLatestMinutes,
  });
}

/**
 * resolveOverallFeasibilityAtArrivals(venue, holidays, params) -> the
 * composed result, from both arrivals directly instead of one shared
 * departure. Plan B needs this arrival-based core because its mid and upper
 * arrivals do not share a departure abs — see resolveFeasibilityAtArrivals
 * for the identical reasoning on the hours side.
 *
 * Resolves the hours-side tier first; hours "invalid"/"hours-unknown"
 * short-circuits before the return side is ever evaluated. Otherwise resolves
 * the return side, composes overall_tier, and — unless the return side is
 * unverified, in which case the hours-only metrics are returned unchanged and
 * labelled as such, per plan.md's "never presented as a verified session
 * length" — recombines metrics per bound via the binding-limit table.
 */
export function resolveOverallFeasibilityAtArrivals(venue, holidays, params) {
  const {
    arrivalMidAbs,
    arrivalUpperAbs,
    travelMinutesMid,
    travelMinutesUpper,
    durationMinutes,
    closingBufferMinutes,
    toleranceMinutes,
    bicycleWithYou,
    raining,
    returnToleranceMinutes = RETURN_TOLERANCE_MINUTES,
    cycleLatestMinutes,
  } = params;

  const hoursResult = resolveFeasibilityAtArrivals(venue, holidays, {
    arrivalMidAbs, arrivalUpperAbs, travelMinutesMid, travelMinutesUpper, durationMinutes, closingBufferMinutes, toleranceMinutes,
  });
  if (hoursResult.tier === "invalid" || hoursResult.tier === "hours-unknown") {
    return hoursResult;
  }

  const sessionEndMidAbs = arrivalMidAbs + durationMinutes;
  const sessionEndUpperAbs = arrivalUpperAbs + durationMinutes;

  const returnResult = resolveReturnFeasibility(venue, holidays, {
    bicycleWithYou, raining, sessionEndMidAbs, sessionEndUpperAbs, toleranceMinutes: returnToleranceMinutes, cycleLatestMinutes,
  });
  if (returnResult.tier === "invalid") return returnResult;

  const tier = overallTier(hoursResult.tier, returnResult.tier);

  // hoursTier/returnTier/returnBasis*/returnModes* are display-safe facts the
  // composition already computes — surfaced here, unchanged, so app.js can
  // show them (PLAN.md:1754/2263-2265) without re-deriving any policy.
  if (returnResult.tier === "unverified") {
    // Hours-only metrics are never governed by the return leg, but that does
    // not mean the hours side always carries a real closing constraint —
    // mirror its own three-way outcome instead of assuming "venue_close"
    // applies uniformly: `latestLeaveAt` is `undefined` when the midpoint has
    // no active period (no binding constraint is displayable at all),
    // "UNDETERMINED" when the hours side is COVERED (no known close within
    // the verified span — the same "none" state `boundBindingMetrics` uses
    // for a COVERED+AT_LEAST(0) combined result), or a real finite number
    // (a genuine closing-time constraint).
    const hoursBindingConstraint =
      hoursResult.latestLeaveAt === undefined
        ? undefined
        : hoursResult.latestLeaveAt === "UNDETERMINED"
        ? "none"
        : "venue_close";
    return {
      tier,
      usableMinutesMid: hoursResult.usableMinutesMid,
      surplusMid: hoursResult.surplusMid,
      latestLeaveAt: hoursResult.latestLeaveAt,
      surplusUpper: hoursResult.surplusUpper,
      metricsBasis: "hours_only",
      hoursTier: hoursResult.tier,
      returnTier: returnResult.tier,
      returnBasisMid: returnResult.basisMid,
      returnBasisUpper: returnResult.basisUpper,
      returnModesMid: returnResult.modesMid,
      returnModesUpper: returnResult.modesUpper,
      bindingConstraint: hoursBindingConstraint,
    };
  }

  const midOutcome = { basis: returnResult.basisMid, lastDepartureAbs: returnResult.lastDepartureAbsMid };
  const upperOutcome = { basis: returnResult.basisUpper, lastDepartureAbs: returnResult.lastDepartureAbsUpper };
  const midMetrics = boundBindingMetrics(venue, holidays, arrivalMidAbs, travelMinutesMid, durationMinutes, closingBufferMinutes, midOutcome);
  const upperMetrics = boundBindingMetrics(venue, holidays, arrivalUpperAbs, travelMinutesUpper, durationMinutes, closingBufferMinutes, upperOutcome);

  return {
    tier,
    usableMinutesMid: midMetrics?.usableMinutes,
    surplusMid: midMetrics?.surplus,
    latestLeaveAt: midMetrics?.latestLeaveAt,
    surplusUpper: upperMetrics?.surplus,
    metricsBasis: "combined",
    hoursTier: hoursResult.tier,
    returnTier: returnResult.tier,
    returnBasisMid: returnResult.basisMid,
    returnBasisUpper: returnResult.basisUpper,
    returnModesMid: returnResult.modesMid,
    returnModesUpper: returnResult.modesUpper,
    bindingConstraint: midMetrics?.bindingConstraint,
  };
}

// --- validate_return_transport (whole-file, standalone) ---------------------

/**
 * validateReturnTransport(venuesMeta) -> {[venueId]: {state:"ok"} | {state:"invalid", reason}}
 *
 * Walks every destination, every mode, every default + by_weekday entry
 * across the whole file. The three MISSING shapes (no block; block present
 * but this destination/mode absent; entry selected but bandless) all stamp
 * "ok" — normaliseBand is only ever called on an entry that actually has a
 * last_departure_band. Classifies per-venue and never aborts.
 */
export function validateReturnTransport(venuesMeta) {
  const status = {};
  for (const venueId of Object.keys(venuesMeta)) {
    const failures = [];
    const returnTransport = venuesMeta[venueId].return_transport;
    if (returnTransport) {
      for (const destination of Object.keys(returnTransport)) {
        for (const mode of Object.keys(returnTransport[destination])) {
          const block = returnTransport[destination][mode];
          const entries = [["default", block.default], ...Object.entries(block.by_weekday ?? {})];
          for (const [dayKey, entry] of entries) {
            if (!entry || !entry.last_departure_band) continue; // MISSING
            const r = normaliseBand(entry.last_departure_band);
            if (r.kind === "malformed") failures.push(`${mode}/${dayKey}: ${r.reason}`);
          }
        }
      }
    }
    status[venueId] = failures.length ? { state: "invalid", reason: failures.join("; ") } : { state: "ok" };
  }
  return status;
}

// --- relative_busyness / seat_confidence ------------------------------------

/**
 * Which hours (0-23) count as "open" for a weekday's regular_hours entry, for
 * the sole purpose of filtering Popular Times buckets — never used for real
 * feasibility. A closed-hour bucket reads a fabricated busyness of 0 in the
 * source data (decisions.md, 2026-08-29, "Independent review of the closed
 * Phase 0") and must be excluded from any median/max/coverage computation.
 *
 * This is a per-weekday, hour-of-day concept, deliberately simpler than the
 * hours-resolution machinery above: a period that crosses midnight is clipped
 * to this same calendar day (hours past 23 are dropped), since Popular Times
 * itself buckets by weekday-and-hour-of-day, not by absolute minute. An
 * always_open period covers all 24 hours.
 */
function openHourSet(regularEntry) {
  const hours = new Set();
  if (!regularEntry || regularEntry.state !== "known") return hours;
  for (const period of regularEntry.periods) {
    if (period.always_open) {
      for (let h = 0; h < 24; h++) hours.add(h);
      continue;
    }
    const startHour = Math.floor(period.open / 60);
    const endHour = Math.min(24, Math.ceil(Math.min(period.close, MINUTES_PER_DAY) / 60));
    for (let h = startHour; h < endHour; h++) hours.add(h);
  }
  return hours;
}

function median(sortedAscending) {
  const n = sortedAscending.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2 : sortedAscending[mid];
}

/** A busyness reading is usable only as a finite number on Popular Times'
 * own 0-100 scale. 0 and 100 are real, legitimate readings (an empty venue at
 * opening, or fully packed) and must not be excluded by a naive falsy check. */
function isValidBusyness(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Reduces a weekday's raw Popular Times records to one validated reading per
 * open hour: Map<hour, busyness>. An hour is included only when it has
 * EXACTLY ONE raw record for that hour, open, AND that record's value is
 * valid (isValidBusyness). Any other shape — zero records, a malformed
 * value, or two-or-more raw records for the same hour (agreeing or not) — is
 * dropped entirely rather than guessed at, the same "contradictory or
 * unusable source data is not silently resolved" discipline the hours-side
 * active-period lookup already applies to disagreeing periods. This is what
 * makes coverage (the Map's size) trustworthy: a corrupted or duplicated
 * feed can never inflate it past the real number of distinct, usable hours.
 */
function distinctValidHours(rawEntries, openHours) {
  const valid = new Map();
  const excluded = new Set();
  for (const e of rawEntries) {
    if (!openHours.has(e.hour)) continue;
    if (valid.has(e.hour) || excluded.has(e.hour)) {
      valid.delete(e.hour);
      excluded.add(e.hour);
      continue;
    }
    if (isValidBusyness(e.busyness)) {
      valid.set(e.hour, e.busyness);
    } else {
      excluded.add(e.hour);
    }
  }
  return valid;
}

/**
 * resolveBusynessBand(venue, arrivalAbs, {n, p, minHistogramHours})
 *   -> {band: "unknown", reason, coverageHours}
 *    | {band: "peak"|"busy"|"quiet"|"typical", delta, medianUsed, coverageHours}
 *
 * Reads only venue.hours.regular_hours[weekday] (never resolveHours/holidays
 * — busyness is a per-weekday historical signal, never date-specific) and
 * venue.popularTimes[weekday] (an array of {hour, busyness}, 0-100). Uses
 * only arrival_mid's hour, per plan.md's symbol table — never the upper
 * bound. The arrival hour is chosen by FLOORING (16:25 reads hour 16).
 *
 * peak takes precedence over busy when both conditions hold. unknown busyness
 * is distinct from a determined band's typical — resolveSeatConfidence relies
 * on that distinction to flag weaker evidence. coverageHours counts only
 * distinct, validated hours (see distinctValidHours) — malformed or
 * duplicated records can never inflate it, and can never produce a
 * determined band on their own hour.
 */
export function resolveBusynessBand(venue, arrivalAbs, options = {}) {
  const { n = BUSYNESS_N, p = BUSYNESS_P, minHistogramHours = MIN_HISTOGRAM_HOURS } = options;

  const weekday = weekdayAbbrev(dateFromAbs(arrivalAbs));
  const arrivalHour = Math.floor(clockMinutesOfDay(arrivalAbs) / 60);

  const openHours = openHourSet(venue.hours?.regular_hours?.[weekday]);
  const rawEntries = venue.popularTimes?.[weekday] ?? [];
  const validHours = distinctValidHours(rawEntries, openHours);

  if (validHours.size < minHistogramHours) {
    return { band: "unknown", reason: "insufficient_coverage", coverageHours: validHours.size };
  }

  if (!validHours.has(arrivalHour)) {
    return { band: "unknown", reason: "no_data", coverageHours: validHours.size };
  }

  const values = [...validHours.values()].sort((a, b) => a - b);
  const medianUsed = median(values);
  const max = values[values.length - 1];
  const arrivalValue = validHours.get(arrivalHour);
  const delta = arrivalValue - medianUsed;

  // peak is a refinement of busy, not an independent check against the
  // maximum alone — otherwise a perfectly flat curve (every value equal to
  // its own max, delta 0) would read "peak" everywhere merely by being
  // trivially close to itself, contradicting "a flat curve lands wholly in
  // typical" (plan.md). Only a value that already clears the busy threshold
  // can be promoted to peak.
  let band;
  if (delta >= n && arrivalValue >= max - p) {
    band = "peak";
  } else if (delta >= n) {
    band = "busy";
  } else if (delta <= -n) {
    band = "quiet";
  } else {
    band = "typical";
  }

  return { band, delta, medianUsed, coverageHours: validHours.size };
}

const SEATABILITY_LADDER = { poor: 1, mixed: 2, usually_available: 3, dependable: 4 };
const SEATABILITY_FROM_LEVEL = { 1: "poor", 2: "mixed", 3: "usually_available", 4: "dependable" };
const BUSYNESS_ADJUSTMENT = { quiet: 1, typical: 0, busy: -1, peak: -2, unknown: 0 };

/**
 * resolveSeatConfidence(baselineSeatability, busynessBand)
 *   -> {confidence, evidenceQuality: "normal"|"weak"}
 *
 * An explicit lookup, never a blended score (plan.md, "4. seat_confidence").
 * baselineSeatability "unknown" always yields confidence "unknown", regardless
 * of busyness — it never averages, never resolves upward. Otherwise the
 * ladder poor(1) < mixed(2) < usually_available(3) < dependable(4) is adjusted
 * by the busyness band and clamped to [1,4]. An unknown busyness band leaves
 * baseline unchanged (adjustment 0) but flags evidenceQuality "weak" — the
 * caller must not treat that reading the same as a determined "typical" band.
 */
export function resolveSeatConfidence(baselineSeatability, busynessBand) {
  if (baselineSeatability === "unknown") {
    return { confidence: "unknown", evidenceQuality: "normal" };
  }
  const level = SEATABILITY_LADDER[baselineSeatability];
  const adjustment = BUSYNESS_ADJUSTMENT[busynessBand.band];
  const clamped = Math.min(4, Math.max(1, level + adjustment));
  return {
    confidence: SEATABILITY_FROM_LEVEL[clamped],
    evidenceQuality: busynessBand.band === "unknown" ? "weak" : "normal",
  };
}

/**
 * meetsConfidenceFloor(confidence, floorConfidence) -> boolean.
 *
 * Reuses SEATABILITY_LADDER, so "unknown" (absent from the ladder) never
 * clears any floor — plan.md: "a poor or unknown fallback is not a plan."
 */
export function meetsConfidenceFloor(confidence, floorConfidence) {
  const level = SEATABILITY_LADDER[confidence];
  const floorLevel = SEATABILITY_LADDER[floorConfidence];
  return level !== undefined && floorLevel !== undefined && level >= floorLevel;
}

// --- Plan B: the dual-bound arrival chain -----------------------------------

/**
 * resolvePlanBArrivals(params) -> {departureMidAbs, departureUpperAbs, arrivalMidAbs, arrivalUpperAbs}
 *
 * plan.md's "Plan B is recalculated, not just second place": the upper bound
 * is the sum of two upper bounds (Plan A's own upper arrival, then the
 * fallback's upper travel time) — never a midpoint-derived arrival. Both
 * legs get the same seatCheckBufferMinutes; the time spent scanning for a
 * seat does not depend on how the first leg went.
 */
export function resolvePlanBArrivals(params) {
  const {
    planAArrivalMidAbs,
    planAArrivalUpperAbs,
    fallbackTravelMinutesMid,
    fallbackTravelMinutesUpper,
    seatCheckBufferMinutes = SEAT_CHECK_BUFFER_MINUTES,
  } = params;

  const departureMidAbs = planAArrivalMidAbs + seatCheckBufferMinutes;
  const departureUpperAbs = planAArrivalUpperAbs + seatCheckBufferMinutes;
  return {
    departureMidAbs,
    departureUpperAbs,
    arrivalMidAbs: departureMidAbs + fallbackTravelMinutesMid,
    arrivalUpperAbs: departureUpperAbs + fallbackTravelMinutesUpper,
  };
}

/**
 * resolveBackupStrength(params) -> {strength: "strong"|"salvage"|"none", reason?}
 *
 * plan.md's "5. backup_strength" grading table. `overallTier` must already be
 * one of robust/tight/shorter/unverified — an hours-unknown or invalid
 * fallback is excluded by the caller before this is ever reached, never
 * defaulted through here. `usableMinutesMid` must already be return-capped
 * (resolveOverallFeasibilityAtArrivals's own output), never the raw hours-
 * capped duration — this function has no way to tell the difference and
 * trusts its caller for that distinction.
 */
export function resolveBackupStrength(params) {
  const {
    overallTier,
    confidence,
    usableMinutesMid,
    minSessionMinutes = PLAN_B_MIN_SESSION_MINUTES,
    minConfidence = PLAN_B_MIN_CONFIDENCE,
  } = params;

  if (!meetsConfidenceFloor(confidence, minConfidence)) {
    return { strength: "none", reason: "confidence_below_floor" };
  }
  if (overallTier === "robust" || overallTier === "tight") {
    return { strength: "strong" };
  }
  if ((usableMinutesMid ?? 0) >= minSessionMinutes) {
    return { strength: "salvage", reason: overallTier === "unverified" ? "unverified_return" : "short_session" };
  }
  return { strength: "none", reason: "below_minimum_minutes" };
}

/**
 * evaluatePlanBFallback(fallbackVenue, holidays, params) -> the fallback's
 * Plan B result: arrivals, its own overall_tier and return-capped metrics,
 * its own seat_confidence, and the graded backup_strength.
 *
 * Scope: evaluates exactly ONE given fallback candidate, at resolved travel
 * minutes the caller supplies (fallbackTravelMinutesMid/Upper) — parsing
 * fallbacks[].travel_band's "N-Mm" string is Phase 1 orchestrator work, not
 * yet built for access[][].band either (see IMP-004's scope exclusions).
 * Selecting the best of several fallback candidates for one venue is
 * likewise out of scope, deferred with the top-level ranking function.
 *
 * A `cycle`-mode fallback link is excluded before any hours or return data
 * is read at all — the bicycle is at home unless bicycleWithYou, and riding
 * a bicycle you didn't bring is not evaluable, not merely infeasible.
 *
 * IMP-004-R1-F01: an `unverified` return has no return-capped usable_minutes
 * at all — there is no known last departure to cap against, so
 * resolveBackupStrength's generic floor check (built for a genuine numeric
 * cap) must never run against the hours-only figure resolveOverallFeasibility
 * AtArrivals falls back to in that branch. plan.md's Plan B section states
 * the unverified rule categorically, not as a floor test: an unverified
 * return caps backup_strength at salvage ONLY when the session already fits
 * on hours alone (the fallback's own hours tier, independent of return, is
 * robust/tight) — never derived from comparing an hours-only minute count
 * against PLAN_B_MIN_SESSION_MINUTES, which is a return-capped quantity by
 * definition and does not exist here. A fallback whose hours tier is
 * "shorter" AND whose return is unverified has neither a known minimum
 * duration nor this categorical allowance, so it fails closed to "none" —
 * the same discipline this codebase applies to every other case where a
 * claim cannot be established either way.
 */
export function evaluatePlanBFallback(fallbackVenue, holidays, params) {
  const {
    fallbackMode,
    fallbackTravelMinutesMid,
    fallbackTravelMinutesUpper,
    planAArrivalMidAbs,
    planAArrivalUpperAbs,
    bicycleWithYou,
    raining,
    durationMinutes,
    closingBufferMinutes,
    toleranceMinutes,
    returnToleranceMinutes,
    cycleLatestMinutes,
    seatCheckBufferMinutes,
    minSessionMinutes,
    minConfidence = PLAN_B_MIN_CONFIDENCE,
  } = params;

  if (fallbackMode === "cycle" && !bicycleWithYou) {
    return { strength: "none", reason: "cycle_fallback_unviable" };
  }

  const arrivals = resolvePlanBArrivals({
    planAArrivalMidAbs, planAArrivalUpperAbs, fallbackTravelMinutesMid, fallbackTravelMinutesUpper, seatCheckBufferMinutes,
  });

  const overall = resolveOverallFeasibilityAtArrivals(fallbackVenue, holidays, {
    arrivalMidAbs: arrivals.arrivalMidAbs,
    arrivalUpperAbs: arrivals.arrivalUpperAbs,
    travelMinutesMid: fallbackTravelMinutesMid,
    travelMinutesUpper: fallbackTravelMinutesUpper,
    durationMinutes, closingBufferMinutes, toleranceMinutes,
    bicycleWithYou, raining, returnToleranceMinutes, cycleLatestMinutes,
  });

  if (overall.tier === "invalid" || overall.tier === "hours-unknown") {
    return {
      strength: "none",
      reason: overall.tier,
      planBArrivalMidAbs: arrivals.arrivalMidAbs,
      planBArrivalUpperAbs: arrivals.arrivalUpperAbs,
    };
  }

  const busyness = resolveBusynessBand(fallbackVenue, arrivals.arrivalMidAbs);
  const seatConfidence = resolveSeatConfidence(fallbackVenue.baseline_seatability, busyness);

  let backup;
  if (overall.tier === "unverified") {
    const hoursOnly = resolveFeasibilityAtArrivals(fallbackVenue, holidays, {
      arrivalMidAbs: arrivals.arrivalMidAbs,
      arrivalUpperAbs: arrivals.arrivalUpperAbs,
      travelMinutesMid: fallbackTravelMinutesMid,
      travelMinutesUpper: fallbackTravelMinutesUpper,
      durationMinutes, closingBufferMinutes, toleranceMinutes,
    });
    const sessionFitsByHoursAlone = hoursOnly.tier === "robust" || hoursOnly.tier === "tight";
    if (!meetsConfidenceFloor(seatConfidence.confidence, minConfidence)) {
      backup = { strength: "none", reason: "confidence_below_floor" };
    } else if (sessionFitsByHoursAlone) {
      backup = { strength: "salvage", reason: "unverified_return" };
    } else {
      backup = { strength: "none", reason: "unverified_return_and_short_session" };
    }
  } else {
    backup = resolveBackupStrength({
      overallTier: overall.tier,
      confidence: seatConfidence.confidence,
      usableMinutesMid: overall.usableMinutesMid,
      minSessionMinutes, minConfidence,
    });
  }

  return {
    ...backup,
    overallTier: overall.tier,
    usableMinutesMid: overall.usableMinutesMid,
    metricsBasis: overall.metricsBasis,
    confidence: seatConfidence.confidence,
    evidenceQuality: seatConfidence.evidenceQuality,
    planBArrivalMidAbs: arrivals.arrivalMidAbs,
    planBArrivalUpperAbs: arrivals.arrivalUpperAbs,
  };
}

// --- resolve_hours ------------------------------------------------------

/**
 * resolve_hours(venue, target_date) -> {state, periods, authority}.
 *
 * authority is "current" (materialised current_hours_by_date entry — complete
 * and authoritative for that date), "holiday_unknown" (a known holiday beyond
 * the current-hours window — a positive assertion of ignorance), or "regular"
 * (the repeating weekly pattern, which is a generalisation that may not hold
 * on any one specific date).
 *
 * Every date goes through this function, including a previous-day lookback —
 * never through regular_hours directly.
 */
export function resolveHours(venue, holidays, targetDate) {
  const hours = venue.hours;
  if (
    targetDate >= hours.current_hours_valid_from &&
    targetDate <= hours.current_hours_valid_through
  ) {
    const entry = hours.current_hours_by_date[targetDate];
    if (!entry) {
      throw new Error(
        `resolveHours: ${targetDate} is inside the current-hours window ` +
          `[${hours.current_hours_valid_from}, ${hours.current_hours_valid_through}] ` +
          `but has no current_hours_by_date entry — malformed data`
      );
    }
    return { state: entry.state, periods: entry.periods || [], authority: "current" };
  }
  if (holidays && Object.prototype.hasOwnProperty.call(holidays, targetDate)) {
    return { state: "unknown", periods: [], authority: "holiday_unknown" };
  }
  const weekday = weekdayAbbrev(targetDate);
  const entry = hours.regular_hours[weekday];
  if (!entry) {
    throw new Error(
      `resolveHours: no regular_hours entry for weekday "${weekday}" (date ${targetDate}) — malformed data`
    );
  }
  return { state: entry.state, periods: entry.periods || [], authority: "regular" };
}

// --- Active-period lookup ------------------------------------------------

/**
 * Finds the period (if any) containing arrivalAbs, applying source-authority
 * rules for whether the previous calendar date may contribute candidate
 * periods at all:
 *
 * - authority "current": the previous date is NOT admitted — the materialised
 *   entry already contains coverage spanning in from earlier dates.
 * - authority "holiday_unknown": the previous date is NOT admitted — a
 *   regular overnight period must not overturn the holiday's assertion of
 *   ignorance about this specific date.
 * - authority "regular": the previous date IS admitted (via resolveHours,
 *   never read raw), since an arrival shortly after midnight may belong to
 *   yesterday's after-midnight period.
 *
 * Returns one of:
 *   {result: "open", date, period, periodEndAbs}
 *   {result: "closed"}    -- every contributing candidate date was definite
 *   {result: "unknown"}   -- no match, and at least one candidate is unknown
 *   {result: "validation_failure", reason}  -- matches disagree on their end
 */
export function findActivePeriod(venue, holidays, arrivalAbs) {
  const arrivalDate = dateFromAbs(arrivalAbs);
  const arrivalHours = resolveHours(venue, holidays, arrivalDate);
  const candidates = [{ date: arrivalDate, hours: arrivalHours }];
  if (arrivalHours.authority === "regular") {
    const prevDate = addDays(arrivalDate, -1);
    candidates.push({ date: prevDate, hours: resolveHours(venue, holidays, prevDate) });
  }

  const candidatePeriods = [];
  for (const c of candidates) {
    if (c.hours.state === "known") {
      for (const p of c.hours.periods) {
        candidatePeriods.push({
          date: c.date,
          period: p,
          startAbs: absMinutes(c.date, p.open),
          endAbs: periodEndAbs(c.date, p),
        });
      }
    }
  }

  const matches = candidatePeriods.filter(
    (cp) => cp.startAbs <= arrivalAbs && arrivalAbs < cp.endAbs
  );

  if (matches.length > 0) {
    const ends = new Set(matches.map((m) => m.endAbs));
    if (ends.size > 1) {
      return {
        result: "validation_failure",
        reason: "matching periods disagree on period_end_abs — contradictory source data",
      };
    }
    const best = matches.reduce((a, b) => (a.endAbs <= b.endAbs ? a : b));
    const authority = candidates.find((c) => c.date === best.date).hours.authority;
    return {
      result: "open",
      date: best.date,
      period: best.period,
      periodEndAbs: best.endAbs,
      authority,
    };
  }

  const anyUnknown = candidates.some((c) => c.hours.state === "unknown");
  return anyUnknown ? { result: "unknown" } : { result: "closed" };
}

// --- effective_close: the cross-date, sequential, lazy walk --------------

/**
 * effectiveClose(venue, holidays, {date, period, authority}, requiredEndAbs)
 *   -> {type: "finite", value} | {type: "COVERED"} | {type: "UNKNOWN"}
 *
 * Never called with a missing active period — the caller returns NONE
 * instead (see resolveBound).
 *
 * A period's own extent is trusted directly — returned as the exact close,
 * whether that yields a shortfall or real slack — whenever nothing about a
 * later calendar date could contradict it:
 *
 *   - a `current`-authority close that does not cross into the next date
 *     (the common case), or one that does (a decomposed multi-day chain) —
 *     current_hours_by_date is complete and authoritative by construction,
 *     so a crossing multi-day close needs no further verification;
 *   - a `regular`-authority close that does NOT cross into the next date —
 *     self-contained within its own day, so no other date's authority can
 *     override it.
 *
 * Three shapes instead require walking into the next date before any claim
 * can be trusted past its boundary, because each is either missing a close
 * entirely or is a generalisation that a specific date could contradict:
 *
 *   - `always_open` (no close exists in this source period, of either
 *     authority — being open 24h on one date says nothing about the next);
 *   - `continues_beyond_window` (Google truncated the true close at the
 *     window edge — the value given is a window artifact, not a real one);
 *   - a `regular`-authority close that crosses into the next calendar date
 *     (a recurring weekly pattern is a generalisation that a holiday, or
 *     other date-specific fact, can override — see plan.md's three-shape
 *     table: even an ordinary overnight regular period must not establish
 *     known coverage on a date it merely crosses but does not verify).
 *
 * The walk only ever looks as far as required_end_abs demands — it never
 * continues merely to discover an exact number it doesn't need.
 */
export function effectiveClose(venue, holidays, start, requiredEndAbs) {
  let date = start.date;
  let period = start.period;
  let authority = start.authority;

  for (;;) {
    const boundaryAbs = absMinutes(addDays(date, 1), 0);
    const crossesIntoNextDate = !period.always_open && absMinutes(date, period.close) > boundaryAbs;
    const needsVerification =
      period.always_open ||
      period.continues_beyond_window ||
      (authority === "regular" && crossesIntoNextDate);

    if (needsVerification) {
      if (requiredEndAbs <= boundaryAbs) return { type: "COVERED" };

      const next = resolveHours(venue, holidays, addDays(date, 1));
      if (next.state === "unknown") return { type: "UNKNOWN" };

      const join =
        next.state === "known" ? next.periods.find((p) => p.open === 0) : undefined;
      if (join) {
        date = addDays(date, 1);
        period = join;
        authority = next.authority;
        continue;
      }
      // No period begins exactly at 00:00: the run genuinely ends at the
      // boundary, and that is itself a known close.
      return { type: "finite", value: boundaryAbs };
    }

    // A genuinely known, trusted finite close — return it exactly, whether
    // it is a shortfall or real slack.
    return { type: "finite", value: periodEndAbs(date, period) };
  }
}

// --- AT_LEAST(0): a tagged sum type, not a number -------------------------

export const AT_LEAST_0 = Object.freeze({ kind: "at_least_0" });

export function finiteSurplus(minutes) {
  return { kind: "finite", minutes };
}

export function passesFeasibility(surplus) {
  return surplus.kind === "at_least_0" ? true : surplus.minutes >= 0;
}

/** Partial function on the finite variant only. Rejects AT_LEAST(0) rather
 * than coercing it — it is never reached with the tag in normal operation,
 * since passesFeasibility(AT_LEAST_0) is always true and short-circuits
 * first; the rejection guards a future refactor reordering the operands. */
export function finiteShortfall(surplus) {
  if (surplus.kind !== "finite") {
    throw new Error("finiteShortfall: AT_LEAST(0) has no finite shortfall");
  }
  if (surplus.minutes >= 0) {
    throw new Error("finiteShortfall: surplus is non-negative, there is no shortfall");
  }
  return -surplus.minutes;
}

export function surplusSortKey(surplus) {
  return surplus.kind === "at_least_0" ? 0 : surplus.minutes;
}

function formatDuration(minutes) {
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}h ${mm}m`;
  if (h > 0) return `${h}h`;
  return `${mm}m`;
}

/** surplusDisplay() must never fall back to surplusSortKey() — rendering
 * AT_LEAST(0) as "0" would claim a venue closes exactly at the deadline when
 * its close was never established. */
export function surplusDisplay(surplus) {
  if (surplus.kind === "at_least_0") return "fits — margin not established";
  return surplus.minutes >= 0
    ? `${formatDuration(surplus.minutes)} spare`
    : `${formatDuration(surplus.minutes)} short`;
}

// --- Per-bound resolution and feasibility tiers ---------------------------

/**
 * Resolves one bound (mid or upper) at one arrival instant. Returns one of:
 *   {kind: "validation_failure", reason}
 *   {kind: "unknown"}   -- hours-unknown: no active period could be
 *                          determined, or effectiveClose returned UNKNOWN
 *   {kind: "none"}      -- NONE: definitely not open at this arrival
 *   {kind: "resolved", usableMinutes, surplus, latestLeaveAt}
 */
export function resolveBound(
  venue,
  holidays,
  arrivalAbs,
  travelMinutes,
  durationMinutes,
  closingBufferMinutes
) {
  const active = findActivePeriod(venue, holidays, arrivalAbs);
  if (active.result === "validation_failure") {
    return { kind: "validation_failure", reason: active.reason };
  }
  if (active.result === "unknown") return { kind: "unknown" };
  if (active.result === "closed") return { kind: "none" };

  const requiredEndAbs = arrivalAbs + durationMinutes + closingBufferMinutes;
  const ec = effectiveClose(
    venue,
    holidays,
    { date: active.date, period: active.period, authority: active.authority },
    requiredEndAbs
  );

  if (ec.type === "UNKNOWN") return { kind: "unknown" };

  if (ec.type === "COVERED") {
    return {
      kind: "resolved",
      usableMinutes: durationMinutes,
      surplus: AT_LEAST_0,
      latestLeaveAt: "UNDETERMINED",
    };
  }

  const closeAdjusted = ec.value - closingBufferMinutes;
  const usableMinutes = Math.max(0, Math.min(closeAdjusted, arrivalAbs + durationMinutes) - arrivalAbs);
  const surplus = finiteSurplus(closeAdjusted - (arrivalAbs + durationMinutes));
  const latestLeaveAt = closeAdjusted - durationMinutes - travelMinutes;
  return { kind: "resolved", usableMinutes, surplus, latestLeaveAt };
}

/**
 * Resolves both bounds independently and assigns the feasibility tier.
 *
 *   robust  : effective_close_upper is not NONE AND passes_feasibility(surplus_upper)
 *   tight   : not robust AND effective_close_mid is not NONE
 *             AND (passes_feasibility(surplus_mid) OR finiteShortfall(surplus_mid) <= tolerance)
 *   shorter : otherwise, including effective_close_mid == NONE
 *   hours-unknown : either bound is UNKNOWN — not ranked, no tier metrics
 *   invalid : either bound hit a validation failure — not ranked
 */
export function resolveFeasibility(venue, holidays, params) {
  const {
    departureDate,
    leaveAtMinutes,
    travelMinutesMid,
    travelMinutesUpper,
    durationMinutes,
    closingBufferMinutes,
    toleranceMinutes,
  } = params;

  const departureAbs = absMinutes(departureDate, leaveAtMinutes);
  const arrivalMidAbs = departureAbs + travelMinutesMid;
  const arrivalUpperAbs = departureAbs + travelMinutesUpper;

  return resolveFeasibilityAtArrivals(venue, holidays, {
    arrivalMidAbs, arrivalUpperAbs, travelMinutesMid, travelMinutesUpper, durationMinutes, closingBufferMinutes, toleranceMinutes,
  });
}

/**
 * resolveFeasibilityAtArrivals(venue, holidays, params) -> same shape as
 * resolveFeasibility, but takes both arrivals directly instead of deriving
 * them from one shared departure. resolveFeasibility is a thin wrapper over
 * this for the ordinary single-departure case; Plan B needs this arrival-
 * based core directly because its mid and upper departures are themselves
 * two different absolute minutes (plan_a_arrival_mid/upper + the seat-check
 * buffer), not one departure paired with two travel-time estimates.
 */
export function resolveFeasibilityAtArrivals(venue, holidays, params) {
  const {
    arrivalMidAbs,
    arrivalUpperAbs,
    travelMinutesMid,
    travelMinutesUpper,
    durationMinutes,
    closingBufferMinutes,
    toleranceMinutes,
  } = params;

  const mid = resolveBound(venue, holidays, arrivalMidAbs, travelMinutesMid, durationMinutes, closingBufferMinutes);
  const upper = resolveBound(venue, holidays, arrivalUpperAbs, travelMinutesUpper, durationMinutes, closingBufferMinutes);

  if (mid.kind === "validation_failure" || upper.kind === "validation_failure") {
    return {
      tier: "invalid",
      reason: mid.kind === "validation_failure" ? mid.reason : upper.reason,
    };
  }
  if (mid.kind === "unknown" || upper.kind === "unknown") {
    return { tier: "hours-unknown" };
  }

  const upperNone = upper.kind === "none";
  const midNone = mid.kind === "none";

  const robust = !upperNone && passesFeasibility(upper.surplus);

  // finiteShortfall is only ever reached here when passesFeasibility(mid.surplus)
  // is false — i.e. a genuine finite negative surplus, never AT_LEAST(0) — so
  // the OR's short-circuit is what keeps this call safe, per finiteShortfall's
  // own contract.
  let tight = false;
  if (!robust && !midNone) {
    tight = passesFeasibility(mid.surplus) || finiteShortfall(mid.surplus) <= toleranceMinutes;
  }

  const tier = robust ? "robust" : tight ? "tight" : "shorter";

  return {
    tier,
    usableMinutesMid: midNone ? undefined : mid.usableMinutes,
    surplusMid: midNone ? undefined : mid.surplus,
    latestLeaveAt: midNone ? undefined : mid.latestLeaveAt,
    surplusUpper: upperNone ? undefined : upper.surplus,
  };
}

// --- The whole-dataset ranking pipeline entry point -------------------------
//
// plan.md's "The ranking pipeline" / "One entry point, pure, whole-dataset":
// everything above this section is reached through rankVenues(), the single
// function app.js calls once per render. No DOM, no I/O.

/** `closing_buffer_minutes: null` in venues_meta.json means "use this
 * constant" (plan.md, "data/venues_meta.json"). */
export const CLOSING_BUFFER_DEFAULT_MINUTES = 30;

function resolveClosingBufferMinutes(venue) {
  return venue.closing_buffer_minutes ?? CLOSING_BUFFER_DEFAULT_MINUTES;
}

/**
 * resolveOutboundMode(venue, origin, mode, raining) -> mode string.
 *
 * wet_weather_mode substitution (plan.md's "Control resolution" / "The rain
 * toggle's effect is explicit"): when raining, venue.wet_weather_mode[origin]
 * may name a substitute for the selected mode — the venue is then reached,
 * and its access band read, via the SUBSTITUTE mode, not the one requested.
 * A mode with no recorded substitute is simply unavailable in the rain and is
 * returned unchanged; this function makes no viability judgement of its own,
 * the caller's ordinary access-lookup rules decide what happens next.
 */
export function resolveOutboundMode(venue, origin, mode, raining) {
  if (!raining) return mode;
  return venue.wet_weather_mode?.[origin]?.[mode] ?? mode;
}

/**
 * validatePreferenceSnapshot(venues) -> Map<venueId, reason>
 *
 * The whole-dataset `preference` invariant (plan.md, "Choosing among several
 * fallbacks": a strict total order, no ties, validated before any ranking key
 * reads it). Missing or non-integer fails that venue alone; a value shared by
 * two-or-more venues fails every venue carrying it, since the order between
 * them is genuinely undetermined and there is no basis for keeping one. A
 * venue absent from the returned map holds a valid, unique preference.
 */
export function validatePreferenceSnapshot(venues) {
  const invalid = new Map();
  const byValue = new Map();
  for (const v of venues) {
    if (!Number.isInteger(v.preference)) {
      invalid.set(v.id, "preference is missing or not an integer");
      continue;
    }
    if (!byValue.has(v.preference)) byValue.set(v.preference, []);
    byValue.get(v.preference).push(v.id);
  }
  for (const ids of byValue.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        invalid.set(id, `preference value is shared by ${ids.length} venues — order between them is undetermined`);
      }
    }
  }
  return invalid;
}

function formatClockTime(abs) {
  const minutes = clockMinutesOfDay(abs);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// The 8-key ranking order (plan.md, "The ranking pipeline") and the
// fallback-selection order's shared tiers (plan.md, "Choosing among several
// fallbacks") both rank the same four/five values; kept as one set of tables
// so the two orderings can never silently drift apart.
const TIER_RANK = { robust: 3, tight: 2, shorter: 1, unverified: 0 };
const CONFIDENCE_RANK = { dependable: 4, usually_available: 3, mixed: 2, poor: 1, unknown: 0 };
const BACKUP_RANK = { strong: 2, salvage: 1, none: 0 };

/**
 * compareCandidates(a, b) -> negative if a ranks before b. The 8-key order
 * exactly: overall_tier, seat_confidence, backup_strength, travel_minutes_mid
 * (least first), preference (lower number first — the same "1 is best"
 * ordinal convention access[][].rank already uses; no venue in the current
 * dataset yet fixes this direction on its own, so it is an implementation
 * choice flagged here for reviewer confirmation), surplus_mid through
 * surplusSortKey() only, then venue_id as a final stable guard.
 */
function compareCandidates(a, b) {
  if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[b.tier] - TIER_RANK[a.tier];
  const ca = CONFIDENCE_RANK[a.seatConfidence.confidence];
  const cb = CONFIDENCE_RANK[b.seatConfidence.confidence];
  if (ca !== cb) return cb - ca;
  if (BACKUP_RANK[a.backupStrength] !== BACKUP_RANK[b.backupStrength]) {
    return BACKUP_RANK[b.backupStrength] - BACKUP_RANK[a.backupStrength];
  }
  if (a.travelMinutesMid !== b.travelMinutesMid) return a.travelMinutesMid - b.travelMinutesMid;
  if (a.preference !== b.preference) return a.preference - b.preference;
  const sa = surplusSortKey(a.surplusMid ?? AT_LEAST_0);
  const sb = surplusSortKey(b.surplusMid ?? AT_LEAST_0);
  if (sa !== sb) return sb - sa;
  return a.venueId < b.venueId ? -1 : a.venueId > b.venueId ? 1 : 0;
}

/**
 * compareFallbacks(a, b) -> the 7-key fallback-selection order (plan.md,
 * "Choosing among several fallbacks"): backup_strength, overall_tier,
 * seat_confidence, fallback travel burden from Plan A, preference, then
 * venue_id. Key 6 (surplus_mid) is deliberately omitted: plan.md states keys
 * 6 and 7 are "unreachable between two distinct ranked venues" once
 * preference has decided, and reached only in the degenerate self-comparison
 * case — so venue_id alone already keeps this total and deterministic
 * without re-deriving a fallback's surplus, which would mean re-evaluating
 * (and, for an unviable cycle link, illegitimately reading) data
 * evaluatePlanBFallback deliberately left untouched.
 */
function compareFallbacks(a, b) {
  if (BACKUP_RANK[a.result.strength] !== BACKUP_RANK[b.result.strength]) {
    return BACKUP_RANK[b.result.strength] - BACKUP_RANK[a.result.strength];
  }
  const ta = TIER_RANK[a.result.overallTier] ?? -1;
  const tb = TIER_RANK[b.result.overallTier] ?? -1;
  if (ta !== tb) return tb - ta;
  const ca = CONFIDENCE_RANK[a.result.confidence] ?? -1;
  const cb = CONFIDENCE_RANK[b.result.confidence] ?? -1;
  if (ca !== cb) return cb - ca;
  if (a.travelMinutesMid !== b.travelMinutesMid) return a.travelMinutesMid - b.travelMinutesMid;
  if (a.preference !== undefined && b.preference !== undefined && a.preference !== b.preference) {
    return a.preference - b.preference;
  }
  return a.fallbackVenueId < b.fallbackVenueId ? -1 : a.fallbackVenueId > b.fallbackVenueId ? 1 : 0;
}

/**
 * selectPlanBFallback(venue, holidays, params, venueById, invalidPreference) ->
 * the winning fallback evaluation (plan.md's "Choosing among several
 * fallbacks"), or `null` when the venue has no `fallbacks[]` at all. Each
 * fallback is evaluated exactly once, via evaluatePlanBFallback — never
 * re-evaluated, no Plan C.
 */
function selectPlanBFallback(venue, holidays, params, venueById, invalidPreference) {
  const links = venue.fallbacks ?? [];
  if (links.length === 0) return null;

  const evaluated = [];
  for (const link of links) {
    const fallbackVenue = venueById.get(link.venue_id);
    if (!fallbackVenue) continue; // a fallback naming an unknown venue is a data-authoring defect outside this contract

    // A fallback venue is still a venue: plan.md's taxonomy states a
    // non-OPERATIONAL venue is "never Plan A or Plan B", the whole-dataset
    // `preference` invariant applies before any ordering key reads it, and
    // STEP 0's return-status precondition is a fact about the venue, not
    // about the primary-candidate path alone. All three gates apply here
    // exactly as they do in the main per-venue loop, before this fallback is
    // ever evaluated (IMP-010-R1-F01: an invalid-preference fallback read
    // from the unfiltered venue map could win the fallback-selection order —
    // including the undocumented venue_id tiebreak — despite being an
    // unranked removal everywhere else in the pipeline).
    if (invalidPreference.has(fallbackVenue.id)) continue;
    if (fallbackVenue.business_status !== "OPERATIONAL") continue;
    const fallbackReturnStatus = fallbackVenue.return_transport_status;
    if (!fallbackReturnStatus || fallbackReturnStatus.state !== "ok") continue;

    const band = normaliseTravelBand(link.travel_band);
    if (band.kind !== "present") continue; // fallbacks[].travel_band is always added complete, per plan.md

    const result = evaluatePlanBFallback(fallbackVenue, holidays, {
      fallbackMode: link.mode,
      fallbackTravelMinutesMid: band.mid,
      fallbackTravelMinutesUpper: band.upper,
      planAArrivalMidAbs: params.arrivalMidAbs,
      planAArrivalUpperAbs: params.arrivalUpperAbs,
      bicycleWithYou: params.bicycleWithYou,
      raining: params.raining,
      durationMinutes: params.durationMinutes,
      closingBufferMinutes: resolveClosingBufferMinutes(fallbackVenue),
      toleranceMinutes: params.toleranceMinutes,
      returnToleranceMinutes: params.returnToleranceMinutes,
      cycleLatestMinutes: params.cycleLatestMinutes,
      seatCheckBufferMinutes: params.seatCheckBufferMinutes,
      minSessionMinutes: params.minSessionMinutes,
      minConfidence: params.minConfidence,
    });

    evaluated.push({
      fallbackVenueId: link.venue_id,
      mode: link.mode,
      travelMinutesMid: band.mid,
      preference: fallbackVenue.preference,
      result,
    });
  }

  if (evaluated.length === 0) return null;
  evaluated.sort(compareFallbacks);
  return evaluated[0];
}

/**
 * rankVenues(snapshot, controls) -> the whole ranking pipeline entry point.
 *
 * snapshot: `{ venues: [...], holidays: {...} }` — the whole embedded
 * dataset. controls: `{ origin, mode, raining, departureDate,
 * leaveAtMinutes, durationMinutes, toleranceMinutes, returnToleranceMinutes,
 * cycleLatestMinutes, seatCheckBufferMinutes, minSessionMinutes,
 * minConfidence }` — the session request plus provisional-constant
 * overrides, threaded straight through to the underlying functions exactly
 * as they already accept them.
 *
 * Ownership order, exactly per plan.md's "One entry point, pure,
 * whole-dataset":
 *   1. control resolution — per venue, wet_weather_mode substitution and
 *      bicycle_with_you (whether THIS venue's resolved outbound mode is
 *      "cycle")
 *   2. snapshot validation — `preference`, over the whole venue list, before
 *      any ranking key reads it
 *   3. travel-band parsing and per-venue arrivals
 *   4. return-status STEP 0 removal
 *   5. evaluation — hours, return, combined feasibility, busyness,
 *      seat_confidence
 *   6. Plan B evaluation for every candidate, before backup_strength ranks
 *      Plan A
 *   7. grouping, refusals and final ordering
 *
 * Returns `{ planA, groups, alternatives, travelUnknown, removed, refusals }`:
 *   - `planA` — the single best candidate (never `unverified` — plan.md: "a
 *     venue whose overall_tier is unverified can never be Plan A"), or
 *     `null` if nothing at all is ranked.
 *   - `groups` — `{ ranked, shorter, unverified }`, each an array of
 *     candidates in full ranking order (plan.md's "ranked and unranked
 *     taxonomy": `ranked` covers `robust`/`tight`; `shorter` and `unverified`
 *     are their own groups).
 *   - `alternatives` — every candidate except `planA`, grouped by `area`,
 *     order preserved within each group (plan.md: "Alternatives are grouped
 *     by area").
 *   - `travelUnknown` — venues with an explicit-`null` access entry: `[{
 *     venueId }]`.
 *   - `removed` — every unranked-removal row of the taxonomy table, each
 *     `{ venueId, reason, kind }`. Access-key-missing venues (hard-filtered)
 *     are absent even from here — plan.md: "not a candidate at all".
 *   - `refusals` — `{ noLowRiskOption, noVerifiedReturn }`. `noLowRiskOption`
 *     is true when no candidate reaches at least `mixed` seat_confidence.
 *     `noVerifiedReturn` is the requested session's end time (`"HH:MM"`,
 *     from the best `unverified` candidate) when `ranked` and `shorter` are
 *     both empty but a qualifying `unverified` candidate exists, else `null`
 *     — plan.md's second refusal, for the return leg specifically.
 */
export function rankVenues(snapshot, controls) {
  const { venues, holidays } = snapshot;
  const {
    origin, mode, raining,
    departureDate, leaveAtMinutes, durationMinutes,
    toleranceMinutes, returnToleranceMinutes, cycleLatestMinutes,
    seatCheckBufferMinutes, minSessionMinutes, minConfidence,
  } = controls;

  const venueById = new Map(venues.map((v) => [v.id, v]));
  const invalidPreference = validatePreferenceSnapshot(venues);
  const departureAbs = absMinutes(departureDate, leaveAtMinutes);

  const removed = [];
  const travelUnknown = [];
  const candidates = [];

  for (const venue of venues) {
    if (invalidPreference.has(venue.id)) {
      removed.push({ venueId: venue.id, reason: invalidPreference.get(venue.id), kind: "preference_invalid" });
      continue;
    }
    if (venue.business_status !== "OPERATIONAL") {
      removed.push({ venueId: venue.id, reason: `business_status is ${venue.business_status}`, kind: "not_operational" });
      continue;
    }

    const resolvedMode = resolveOutboundMode(venue, origin, mode, raining);
    const destAccess = venue.access?.[origin] ?? {};
    if (!Object.prototype.hasOwnProperty.call(destAccess, resolvedMode)) {
      continue; // hard-filtered: not a candidate at all, not even the travel-unknown group
    }
    const accessEntry = destAccess[resolvedMode];
    if (accessEntry == null) {
      travelUnknown.push({ venueId: venue.id });
      continue;
    }

    const travelBand = normaliseTravelBand(accessEntry.band);
    if (travelBand.kind !== "present") {
      removed.push({ venueId: venue.id, reason: `access band: ${travelBand.reason ?? "not measured"}`, kind: "access_band_invalid" });
      continue;
    }

    const returnStatus = venue.return_transport_status;
    if (!returnStatus || returnStatus.state !== "ok") {
      removed.push({
        venueId: venue.id,
        reason: returnStatus ? `return_transport_status is ${returnStatus.state}` : "return_transport_status is absent — never validated",
        kind: "return_data_broken",
      });
      continue;
    }

    const bicycleWithYou = resolvedMode === "cycle";
    const overall = resolveOverallFeasibility(venue, holidays, {
      departureDate, leaveAtMinutes,
      travelMinutesMid: travelBand.mid, travelMinutesUpper: travelBand.upper,
      durationMinutes, closingBufferMinutes: resolveClosingBufferMinutes(venue), toleranceMinutes,
      bicycleWithYou, raining, returnToleranceMinutes, cycleLatestMinutes,
    });

    if (overall.tier === "invalid") {
      removed.push({ venueId: venue.id, reason: overall.reason, kind: "contradictory_hours" });
      continue;
    }
    if (overall.tier === "hours-unknown") {
      removed.push({ venueId: venue.id, reason: "hours could not be resolved for this arrival", kind: "hours_unknown" });
      continue;
    }

    const arrivalMidAbs = departureAbs + travelBand.mid;
    const arrivalUpperAbs = departureAbs + travelBand.upper;

    const busyness = resolveBusynessBand(venue, arrivalMidAbs);
    const seatConfidence = resolveSeatConfidence(venue.baseline_seatability, busyness);

    const planB = selectPlanBFallback(venue, holidays, {
      arrivalMidAbs, arrivalUpperAbs, bicycleWithYou, raining,
      durationMinutes, toleranceMinutes, returnToleranceMinutes, cycleLatestMinutes,
      seatCheckBufferMinutes, minSessionMinutes, minConfidence,
    }, venueById, invalidPreference);

    candidates.push({
      venueId: venue.id,
      area: venue.area,
      tier: overall.tier,
      seatConfidence,
      baselineSeatability: venue.baseline_seatability,
      busynessBand: busyness,
      backupStrength: planB ? planB.result.strength : "none",
      travelMinutesMid: travelBand.mid,
      preference: venue.preference,
      surplusMid: overall.surplusMid,
      usableMinutesMid: overall.usableMinutesMid,
      latestLeaveAt: overall.latestLeaveAt,
      metricsBasis: overall.metricsBasis,
      hoursTier: overall.hoursTier,
      returnTier: overall.returnTier,
      bindingConstraint: overall.bindingConstraint,
      returnBasis: overall.returnBasisMid,
      returnModes: overall.returnModesMid,
      sessionEndMidAbs: arrivalMidAbs + durationMinutes,
      planB: planB && planB.result.strength !== "none" ? {
        venueId: planB.fallbackVenueId,
        mode: planB.mode,
        overallTier: planB.result.overallTier,
        strength: planB.result.strength,
        usableMinutesMid: planB.result.usableMinutesMid,
      } : null,
    });
  }

  candidates.sort(compareCandidates);

  const groups = {
    ranked: candidates.filter((c) => c.tier === "robust" || c.tier === "tight"),
    shorter: candidates.filter((c) => c.tier === "shorter"),
    unverified: candidates.filter((c) => c.tier === "unverified"),
  };

  const planA = groups.ranked[0] ?? groups.shorter[0] ?? null;

  const alternatives = {};
  for (const c of candidates) {
    if (c === planA) continue;
    (alternatives[c.area] ??= []).push(c);
  }

  const qualifying = candidates.filter((c) => meetsConfidenceFloor(c.seatConfidence.confidence, "mixed"));
  const noLowRiskOption = qualifying.length === 0;

  let noVerifiedReturn = null;
  if (groups.ranked.length === 0 && groups.shorter.length === 0 && groups.unverified.length > 0) {
    noVerifiedReturn = formatClockTime(groups.unverified[0].sessionEndMidAbs);
  }

  return {
    planA,
    groups,
    alternatives,
    travelUnknown,
    removed,
    refusals: { noLowRiskOption, noVerifiedReturn },
  };
}
