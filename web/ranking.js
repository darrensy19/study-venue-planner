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
