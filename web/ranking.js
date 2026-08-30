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
  if (modes.size === 0) return { kind: "unverified", basis: "no_recorded_route" };

  if ([...modes].some((m) => SCHEDULE_FREE_MODES.has(m))) {
    return { kind: "pass", basis: "schedule_free", margin: AT_LEAST_0 };
  }

  if (clock >= RETURN_CORE_FROM_MINUTES && clock <= RETURN_CORE_UNTIL_MINUTES) {
    return { kind: "pass", basis: "core_span", margin: AT_LEAST_0 };
  }

  if (clock >= RETURN_SERVICE_DAY_START_MINUTES && clock < RETURN_CORE_FROM_MINUTES) {
    return { kind: "unverified", basis: "pre_dawn_gap" };
  }

  const resolved = [...modes].map((m) => resolveReturnService(venue, holidays, "origin_a", m, serviceDate));
  const malformed = resolved.find((r) => r.kind === "malformed");
  if (malformed) return { kind: "validation_failure", reason: malformed.reason };

  const present = resolved.filter((r) => r.kind === "present");
  if (present.length === 0) return { kind: "unverified", basis: "no_data" };

  const lastDepartureAbs = Math.max(
    ...present.map((band) => absMinutes(serviceDate, lastDepartureEdge(band, boundKind)))
  );
  return {
    kind: "pass",
    basis: "last_departure",
    margin: finiteSurplus(lastDepartureAbs - sessionEndAbs),
    lastDepartureAbs,
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
    return { tier: "unverified", basisMid: mid.basis, basisUpper: upper.basis };
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
    return { usableMinutes: durationMinutes, surplus: AT_LEAST_0, latestLeaveAt: "UNDETERMINED" };
  }
  const bindingLimitAbs = combined.bindingLimitAbs;
  const usableMinutes = Math.max(0, Math.min(bindingLimitAbs, arrivalAbs + durationMinutes) - arrivalAbs);
  const surplus = finiteSurplus(bindingLimitAbs - (arrivalAbs + durationMinutes));
  const latestLeaveAt = bindingLimitAbs - durationMinutes - travelMinutes;
  return { usableMinutes, surplus, latestLeaveAt };
}

/**
 * resolveOverallFeasibility(venue, holidays, params) -> the composed result.
 *
 * Calls the existing, unmodified resolveFeasibility for the hours-side tier
 * first (zero risk to the hours test suite); hours "invalid"/"hours-unknown"
 * short-circuits before the return side is ever evaluated. Otherwise resolves
 * the return side, composes overall_tier, and — unless the return side is
 * unverified, in which case the hours-only metrics are returned unchanged and
 * labelled as such, per plan.md's "never presented as a verified session
 * length" — recombines metrics per bound via the binding-limit table.
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

  const hoursResult = resolveFeasibility(venue, holidays, {
    departureDate, leaveAtMinutes, travelMinutesMid, travelMinutesUpper, durationMinutes, closingBufferMinutes, toleranceMinutes,
  });
  if (hoursResult.tier === "invalid" || hoursResult.tier === "hours-unknown") {
    return hoursResult;
  }

  const departureAbs = absMinutes(departureDate, leaveAtMinutes);
  const arrivalMidAbs = departureAbs + travelMinutesMid;
  const arrivalUpperAbs = departureAbs + travelMinutesUpper;
  const sessionEndMidAbs = arrivalMidAbs + durationMinutes;
  const sessionEndUpperAbs = arrivalUpperAbs + durationMinutes;

  const returnResult = resolveReturnFeasibility(venue, holidays, {
    bicycleWithYou, raining, sessionEndMidAbs, sessionEndUpperAbs, toleranceMinutes: returnToleranceMinutes, cycleLatestMinutes,
  });
  if (returnResult.tier === "invalid") return returnResult;

  const tier = overallTier(hoursResult.tier, returnResult.tier);

  if (returnResult.tier === "unverified") {
    return {
      tier,
      usableMinutesMid: hoursResult.usableMinutesMid,
      surplusMid: hoursResult.surplusMid,
      latestLeaveAt: hoursResult.latestLeaveAt,
      surplusUpper: hoursResult.surplusUpper,
      metricsBasis: "hours_only",
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
