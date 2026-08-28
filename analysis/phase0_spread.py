"""Phase 0, step 6 — Popular Times spread, coverage, and the N / P proposal.

    .venv/bin/python3 analysis/phase0_spread.py

This is Phase 0's acceptance artifact. It measures the shape of the histograms
and proposes `N` and `P` from that measurement, with the evidence attached.

Two warnings from plan.md are built into the output rather than left to memory:

  1. If the median venue's range is under roughly 20 points, banding barely
     discriminates and `baseline_seatability` carries the ranking. That is a
     finding to record, **not** a problem to fix by shrinking `N` until the
     bands look busy. The script says so in its own output.

  2. This measures the histogram's shape. It does **not** establish that Popular
     Times predicts seat availability. Nothing in Phase 0 can.

Band rule under test, from plan.md:

    delta = busyness(hour) - median(venue, weekday)
    peak     within P points of that venue/weekday's maximum   (takes precedence)
    busy     delta >=  N
    typical  -N < delta < N
    quiet    delta <= -N
    unknown  coverage below MIN_HISTOGRAM_HOURS

Reads data/phase0/histograms.json. Writes data/phase0/spread_report.md.
"""

import argparse
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build.phase0_common import PHASE0_DIR, WEEKDAYS, read_json, rel  # noqa: E402

HISTOGRAMS_PATH = PHASE0_DIR / "histograms.json"
REPORT_PATH = PHASE0_DIR / "spread_report.md"

DEFAULT_MIN_HOURS = 6
N_CANDIDATES = [5, 8, 10, 12, 15, 20, 25]
P_CANDIDATES = [0, 2, 3, 5, 8, 10, 15, 20]
FLAT_CURVE_RANGE_THRESHOLD = 20


def percentile(values, fraction):
    """Nearest-rank percentile. Plain and predictable at small sample sizes."""
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


def curve_stats(buckets):
    values = [b["busyness"] for b in buckets]
    if not values:
        return None
    quartile_1 = percentile(values, 0.25)
    quartile_3 = percentile(values, 0.75)
    median = statistics.median(values)
    return {
        "hours": len(values),
        "min": min(values),
        "max": max(values),
        "range": max(values) - min(values),
        "median": median,
        "iqr": quartile_3 - quartile_1,
        "median_to_max": max(values) - median,
        "median_to_min": median - min(values),
    }


def open_hour_set(periods):
    """Hour-of-day integers (0-23) this day's own periods cover.

    Caps a period's close at this day's own midnight (1440). A period that
    spills into the next calendar day is that next day's own concern — this
    function answers "is this hour open on the day whose periods were
    passed in", nothing about adjacent days. An `always_open` period covers
    every hour by definition.
    """
    hours = set()
    for period in periods:
        if period.get("always_open"):
            return set(range(24))
        start_hour = period["open"] // 60
        end_hour = min(period["close"], 1440) // 60
        hours.update(range(start_hour, min(end_hour, 24)))
    return hours


def filter_to_open_hours(buckets, periods):
    """Drop any bucket outside this day's own recorded open hours.

    Popular Times reports busyness as 0 for hours the venue is closed — that
    is a fact about closure, not a `quiet` reading, and letting it into the
    median/percentile math conflates the two. A day with no recorded periods
    (including the `day_absent_from_regular_hours` gap on a `multi_day_period`
    venue — see decisions.md, 2026-08-29) filters to nothing, which correctly
    drops that curve out of eligibility rather than silently scoring it wrong.
    """
    if periods is None:
        return buckets
    open_hours = open_hour_set(periods)
    return [b for b in buckets if b["hour"] in open_hours]


def collect(venues, min_hours, hours_by_seed=None):
    """Per venue/weekday stats, plus every delta, for eligible curves only."""
    curves = []
    excluded_closed_hours = 0
    for venue in venues:
        histogram = venue.get("histogram") or {}
        venue_hours = (hours_by_seed or {}).get(venue.get("seed_no"))
        for day in WEEKDAYS:
            raw_buckets = histogram.get(day) or []
            if venue_hours is not None:
                periods = (venue_hours.get("regular_hours") or {}).get(day)
                buckets = filter_to_open_hours(raw_buckets, periods)
                excluded_closed_hours += len(raw_buckets) - len(buckets)
            else:
                buckets = raw_buckets
            stats = curve_stats(buckets)
            if stats is None:
                curves.append(
                    {
                        "venue": venue.get("name", "?"),
                        "seed_no": venue.get("seed_no"),
                        "day": day,
                        "stats": None,
                        "eligible": False,
                        "deltas": [],
                    }
                )
                continue
            eligible = stats["hours"] >= min_hours
            deltas = [b["busyness"] - stats["median"] for b in buckets] if eligible else []
            curves.append(
                {
                    "venue": venue.get("name", "?"),
                    "seed_no": venue.get("seed_no"),
                    "day": day,
                    "stats": stats,
                    "eligible": eligible,
                    "deltas": deltas,
                    "buckets": buckets,
                }
            )
    return curves, excluded_closed_hours


def band_mix(curves, n_value, p_value):
    """Band distribution across every eligible hour, with peak taking precedence."""
    counts = {"peak": 0, "busy": 0, "typical": 0, "quiet": 0}
    peak_per_curve = []
    for curve in curves:
        if not curve["eligible"]:
            continue
        maximum = curve["stats"]["max"]
        median = curve["stats"]["median"]
        peaks_here = 0
        for bucket in curve["buckets"]:
            value = bucket["busyness"]
            delta = value - median
            if value >= maximum - p_value:
                counts["peak"] += 1
                peaks_here += 1
            elif delta >= n_value:
                counts["busy"] += 1
            elif delta <= -n_value:
                counts["quiet"] += 1
            else:
                counts["typical"] += 1
        peak_per_curve.append(peaks_here)
    total = sum(counts.values())
    return counts, total, peak_per_curve


def propose_n(all_deltas):
    """Pick the candidate N nearest the 67th percentile of |delta|.

    Rationale, stated so it can be argued with: N is the point at which an hour
    stops being ordinary for this venue. Setting it at the 67th percentile of
    |delta| leaves roughly two thirds of hours `typical` and splits the rest
    between `busy` and `quiet` — a band that fires often enough to be useful
    and rarely enough to mean something.
    """
    target = percentile([abs(d) for d in all_deltas], 0.67)
    if target is None:
        return None, None
    return min(N_CANDIDATES, key=lambda c: abs(c - target)), target


def propose_p(curves, n_value):
    """Smallest candidate P averaging 1-3 peak hours per venue/weekday."""
    for candidate in P_CANDIDATES:
        _, _, peaks = band_mix(curves, n_value, candidate)
        if peaks and 1 <= statistics.mean(peaks) <= 3:
            return candidate, statistics.mean(peaks)
    return None, None


def very_quiet_evidence(curves, n_value):
    """Does any venue show repeatable troughs ~2N below its median?

    plan.md admits `very_quiet` only on that evidence. "Repeatable" is read as
    the trough appearing on at least four of the seven weekdays — a single deep
    Sunday morning is noise, not a band.
    """
    by_venue = {}
    for curve in curves:
        if not curve["eligible"]:
            continue
        deep = curve["stats"]["median_to_min"] >= 2 * n_value
        by_venue.setdefault(curve["venue"], []).append(deep)
    repeatable = {
        venue: sum(flags) for venue, flags in by_venue.items() if sum(flags) >= 4
    }
    any_day = {venue: sum(flags) for venue, flags in by_venue.items() if sum(flags) > 0}
    return repeatable, any_day


def main():
    parser = argparse.ArgumentParser(description="Measure histogram spread; propose N and P.")
    parser.add_argument(
        "--min-hours",
        type=int,
        default=DEFAULT_MIN_HOURS,
        help=f"MIN_HISTOGRAM_HOURS under test (default {DEFAULT_MIN_HOURS})",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=HISTOGRAMS_PATH,
        help="histograms JSON to analyse (default data/phase0/histograms.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPORT_PATH,
        help="where to write the markdown report",
    )
    parser.add_argument(
        "--hours",
        type=Path,
        default=PHASE0_DIR / "hours_summary.json",
        help="hours summary JSON, used to exclude closed-hour buckets (default data/phase0/hours_summary.json)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"missing {args.input} — run build/phase0_busyness.py first.")

    hours_by_seed = None
    if args.hours.exists():
        hours_data = read_json(args.hours)
        hours_by_seed = {v["seed_no"]: v for v in hours_data.get("venues", []) if "error" not in v}
    else:
        print(
            f"WARNING: {args.hours} not found — cannot exclude closed-hour buckets. "
            f"Popular Times reports 0 busyness while closed, which is not the same as "
            f"`quiet`; without the hours file every stat below includes those hours."
        )

    data = read_json(args.input)
    venues = data.get("venues", [])
    curves, excluded_closed_hours = collect(venues, args.min_hours, hours_by_seed)

    eligible = [c for c in curves if c["eligible"]]
    populated = [c for c in curves if c["stats"] is not None]
    if not eligible:
        sys.exit(
            f"no venue/weekday curve reaches {args.min_hours} hourly buckets. "
            f"Either the histograms are missing or MIN_HISTOGRAM_HOURS is too high."
        )

    all_deltas = [d for c in eligible for d in c["deltas"]]
    ranges = [c["stats"]["range"] for c in eligible]
    median_range = statistics.median(ranges)
    flat = median_range < FLAT_CURVE_RANGE_THRESHOLD

    n_value, n_target = propose_n(all_deltas)
    p_value, p_mean = propose_p(eligible, n_value)
    repeatable_troughs, any_troughs = very_quiet_evidence(eligible, n_value)

    coverage = [c["stats"]["hours"] for c in populated]
    below_min = [c for c in populated if not c["eligible"]]

    report = build_report(
        args=args,
        venues=venues,
        curves=curves,
        eligible=eligible,
        populated=populated,
        coverage=coverage,
        below_min=below_min,
        ranges=ranges,
        median_range=median_range,
        flat=flat,
        all_deltas=all_deltas,
        n_value=n_value,
        n_target=n_target,
        p_value=p_value,
        p_mean=p_mean,
        repeatable_troughs=repeatable_troughs,
        any_troughs=any_troughs,
        excluded_closed_hours=excluded_closed_hours,
        filtered_to_open_hours=hours_by_seed is not None,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")

    print(f"Wrote {args.output}\n")
    if hours_by_seed is not None:
        print(f"  closed-hour buckets excluded: {excluded_closed_hours}")
    print(f"  eligible curves:        {len(eligible)} of {len(curves)} venue/weekday pairs")
    print(f"  median per-curve range: {median_range:.1f} points")
    print(f"  proposed N:             {n_value}   (67th pct of |delta| = {n_target})")
    print(f"  proposed P:             {p_value}   (mean {p_mean:.1f} peak hours/curve)"
          if p_value is not None else "  proposed P:             no candidate gave 1-3 peak hours/curve")
    print(f"  very_quiet:             {'evidence found' if repeatable_troughs else 'no repeatable troughs — stays deferred'}")
    if flat:
        print(
            f"\n  FINDING: median range {median_range:.1f} < {FLAT_CURVE_RANGE_THRESHOLD}. "
            f"Banding will barely discriminate and baseline_seatability carries the "
            f"ranking. Record this — do not shrink N to make the bands look busy."
        )
    print(f"\n  Paste {args.output} into decisions.md with the chosen values.")


def build_report(**ctx):
    args = ctx["args"]
    lines = [
        "# Phase 0 — Popular Times spread, coverage, and the N / P proposal",
        "",
        f"{len(ctx['venues'])} venues, {len(ctx['populated'])} populated venue/weekday curves, "
        f"{len(ctx['eligible'])} of them at or above MIN_HISTOGRAM_HOURS = {args.min_hours}.",
        "",
        "**This measures the histogram's shape. It does not establish that Popular Times "
        "predicts seat availability** — nothing in Phase 0 can, and no line below should be "
        "read as evidence for it.",
        "",
    ]
    if ctx.get("filtered_to_open_hours"):
        lines += [
            f"**Closed-hour buckets are excluded from every statistic below "
            f"({ctx['excluded_closed_hours']} buckets removed).** Popular Times reports 0 "
            f"busyness for hours a venue is closed — that is a fact about closure, not a "
            f"`quiet` reading, and an earlier run of this script that did not exclude them "
            f"reported a median range roughly 3-4x too high because it was measuring "
            f"'closed vs peak' rather than 'quiet vs busy while open'. Any weekday whose "
            f"regular hours could not be determined (e.g. the `multi_day_period` gap "
            f"recorded in decisions.md) filters to zero open hours and correctly drops out "
            f"of eligibility below, rather than being scored on a guess.",
            "",
        ]
    else:
        lines += [
            "> **No hours file was available — closed hours are NOT excluded from the "
            "figures below.** Popular Times reports 0 busyness while a venue is closed, "
            "which will inflate every range/spread statistic. Re-run with "
            "data/phase0/hours_summary.json present before trusting these numbers.",
            "",
        ]
    lines += [
        "## Headline",
        "",
        "| Measure | Value |",
        "| --- | --- |",
        f"| Median per-curve range (max − min) | **{ctx['median_range']:.1f}** points |",
        f"| Mean per-curve range | {statistics.mean(ctx['ranges']):.1f} points |",
        f"| Median per-curve IQR | {statistics.median([c['stats']['iqr'] for c in ctx['eligible']]):.1f} |",
        f"| Median per-curve median→max | {statistics.median([c['stats']['median_to_max'] for c in ctx['eligible']]):.1f} |",
        f"| Proposed `N` | **{ctx['n_value']}** |",
        f"| Proposed `P` | **{ctx['p_value'] if ctx['p_value'] is not None else 'no candidate fits'}** |",
        "",
    ]

    if ctx["flat"]:
        lines += [
            f"> **Finding — flat curves.** The median curve spans {ctx['median_range']:.1f} points, "
            f"under the ~{FLAT_CURVE_RANGE_THRESHOLD}-point threshold plan.md set in advance. "
            f"Banding will barely discriminate, and `baseline_seatability` carries the ranking "
            f"until Phase 3. plan.md names this outcome ahead of time as a legitimate finding to "
            f"record, **not** a problem to fix by shrinking `N` until the bands look busy.",
            "",
        ]

    lines += [
        "## Coverage — is `MIN_HISTOGRAM_HOURS = 6` right?",
        "",
        "| Measure | Value |",
        "| --- | --- |",
        f"| Populated curves | {len(ctx['populated'])} |",
        f"| Min hourly buckets on a curve | {min(ctx['coverage'])} |",
        f"| Median hourly buckets | {statistics.median(ctx['coverage']):.0f} |",
        f"| Max hourly buckets | {max(ctx['coverage'])} |",
        f"| Curves below {args.min_hours} buckets (band → `unknown`) | {len(ctx['below_min'])} |",
        "",
    ]
    if ctx["below_min"]:
        lines += ["Curves that would band as `unknown`:", ""]
        lines += [
            f"- {c['venue']} / {c['day']} — {c['stats']['hours']} buckets" for c in ctx["below_min"]
        ]
        lines.append("")

    deltas = [abs(d) for d in ctx["all_deltas"]]
    lines += [
        "## Choosing `N` — distribution of |delta| from each curve's own median",
        "",
        "| Percentile | \\|delta\\| |",
        "| --- | --- |",
    ]
    for fraction in (0.50, 0.67, 0.75, 0.90):
        lines.append(f"| {int(fraction * 100)}th | {percentile(deltas, fraction)} |")
    lines += [
        "",
        f"`N` is proposed as **{ctx['n_value']}**, the candidate nearest the 67th percentile "
        f"({ctx['n_target']}). That leaves roughly two thirds of hours `typical` and splits the "
        f"rest between `busy` and `quiet` — often enough to be useful, rarely enough to mean "
        f"something.",
        "",
        "Band mix at each candidate `N` (peak precedence applied at the proposed `P`):",
        "",
        "| `N` | peak | busy | typical | quiet |",
        "| --- | --- | --- | --- | --- |",
    ]
    p_for_mix = ctx["p_value"] if ctx["p_value"] is not None else 0
    for candidate in N_CANDIDATES:
        counts, total, _ = band_mix(ctx["eligible"], candidate, p_for_mix)
        marker = " ←" if candidate == ctx["n_value"] else ""
        lines.append(
            f"| {candidate}{marker} | "
            + " | ".join(f"{100 * counts[band] / total:.0f}%" for band in ("peak", "busy", "typical", "quiet"))
            + " |"
        )

    lines += [
        "",
        "## Choosing `P` — how wide is \"within P points of the maximum\"?",
        "",
        "| `P` | mean peak hours per curve | max peak hours on one curve |",
        "| --- | --- | --- |",
    ]
    for candidate in P_CANDIDATES:
        _, _, peaks = band_mix(ctx["eligible"], ctx["n_value"], candidate)
        marker = " ←" if candidate == ctx["p_value"] else ""
        lines.append(
            f"| {candidate}{marker} | {statistics.mean(peaks):.1f} | {max(peaks)} |"
        )
    lines += [
        "",
        "`P` is proposed as the smallest candidate averaging 1-3 `peak` hours per venue/weekday. "
        "Wider and `peak` stops marking the genuinely worst hour and starts swallowing the "
        "afternoon.",
        "",
    ]
    if ctx["p_value"] == P_CANDIDATES[0]:
        lines += [
            f"> **Caveat.** The smallest candidate on the grid (`P` = {P_CANDIDATES[0]}) already "
            f"fits, so the grid did not bracket the answer from below. `P` = 0 means *exactly at "
            f"the maximum*, which makes `peak` fire on a single bucket that ordinary noise could "
            f"move. Look at the curve shapes before accepting it.",
            "",
        ]
    lines += [
        "## Does `very_quiet` earn a place?",
        "",
        f"plan.md admits it only on repeatable troughs around `2N` = {2 * ctx['n_value']} points "
        f"below the median. Read here as the trough appearing on at least four of seven weekdays.",
        "",
    ]
    if ctx["repeatable_troughs"]:
        lines += ["| Venue | Weekdays with a deep trough |", "| --- | --- |"]
        lines += [f"| {v} | {n} |" for v, n in sorted(ctx["repeatable_troughs"].items())]
        lines += ["", "**Evidence found.** `very_quiet` can be argued for in Phase 1."]
    else:
        lines.append(
            f"**No repeatable troughs.** {len(ctx['any_troughs'])} venue(s) show a deep trough on "
            f"fewer than four weekdays, which is noise, not a band. `very_quiet` stays deferred."
        )

    lines += [
        "",
        "## Per venue / weekday spread",
        "",
        "| Venue | Day | Hours | Min | Max | Range | Median | IQR | Med→Max |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for curve in ctx["curves"]:
        if curve["stats"] is None:
            lines.append(f"| {curve['venue']} | {curve['day']} | 0 | — | — | — | — | — | — |")
            continue
        stats = curve["stats"]
        flag = "" if curve["eligible"] else " *(below min)*"
        lines.append(
            f"| {curve['venue']}{flag} | {curve['day']} | {stats['hours']} | {stats['min']} | "
            f"{stats['max']} | {stats['range']} | {stats['median']:.1f} | {stats['iqr']} | "
            f"{stats['median_to_max']:.1f} |"
        )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
