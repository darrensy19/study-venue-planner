#!/usr/bin/env python3
"""Compute whether a claude_only sampling audit is due, from reviews/AUDIT-LOG.md.

Three subtleties this script exists to get right, each of which was wrong in an
earlier version and reproduced by hand before being fixed:

1. **Ordinals are permanent.** Assignments due for sampling are identified by
   position among all-time `claude_only` `completed` events (1st, 2nd, 3rd, ...),
   assigned once and never recomputed. An earlier version filtered out
   already-sampled completions *before* counting to 4, which shifts the position
   every time a sample is taken — after completion 4 is sampled, the remaining
   list's 4th entry is completion 6, not 8, so nearly every later completion
   became a candidate and the real rate ran far hotter than 1-in-4.

2. **Rate changes apply forward, not retroactively.** A `rate_changed` event
   carrying `interval=2` changes the interval for completions appended *after*
   it. Applying it retroactively would re-select historical ordinals and violate
   (1); ignoring it entirely — the earlier behaviour — meant WORKFLOW.md's
   escalation rule was parsed but never enforced.

3. **`sampled` selects; only `audited` clears — and order is enforced.** A pending
   candidate is cleared when an audit covering it actually completed, not merely
   when it was selected. The two are linked by an `audit=<id>` token that both rows
   carry, and the log is walked sequentially so an `audited` row cannot clear a
   `sampled` row that appears after it. An earlier version collected every audit
   token globally before matching, which meant `audited(A1)` followed later by
   `sampled(A1)` silently cleared work the audit had finished before selecting, and
   one spent token could clear any number of later samples.

Advisory only — WORKFLOW.md is explicit that a due audit is a visible warning,
never a hard block, so exit is 0 whether due or not. Malformed input still fails
loudly (exit 2).

Stdlib only.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

# Match broadly, then validate — a pattern that only matched well-formed values
# would silently skip a malformed row instead of rejecting it.
ROW_RE = re.compile(
    r"^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*(.*?)\s*\|\s*$"
)
HEADER_OR_SEPARATOR_RE = re.compile(r"^\|\s*(Date|:?-{3,})")
INTERVAL_RE = re.compile(r"\binterval\s*=\s*(\d+)\b")
AUDIT_TOKEN_RE = re.compile(r"\baudit\s*=\s*([\w.-]+)")

VALID_KINDS = {"completed", "sampled", "audited", "rate_changed"}
PENDING_THRESHOLD = 3
STALE_DAYS = 30
DEFAULT_INTERVAL = 4


class AuditLogError(Exception):
    """Malformed log — a real parse failure, not an advisory condition."""


@dataclass
class Event:
    line_no: int
    event_date: date
    kind: str
    assignment_id: str
    route: str
    detail: str


def parse_log(text: str) -> list[Event]:
    events: list[Event] = []
    seen_completed_ids: set[str] = set()
    # Walked sequentially so ordering violations are caught at parse time rather
    # than being invisible to a later set-based match.
    open_audit_tokens: dict[str, list[str]] = {}
    closed_audit_tokens: set[str] = set()

    for line_no, line in enumerate(text.splitlines(), start=1):
        if not line.strip().startswith("|"):
            continue  # prose outside the table
        if HEADER_OR_SEPARATOR_RE.match(line):
            continue  # header row and its --- separator

        m = ROW_RE.match(line)
        if not m:
            raise AuditLogError(f"line {line_no}: malformed table row: {line.strip()!r}")
        d, kind, aid, route, detail = m.groups()

        try:
            event_date = date.fromisoformat(d)
        except ValueError:
            raise AuditLogError(f"line {line_no}: unparseable date {d!r}")
        if kind not in VALID_KINDS:
            raise AuditLogError(f"line {line_no}: unknown event kind {kind!r}")

        if kind == "completed":
            # Assignment IDs are never reused (WORKFLOW.md's allocation rule), so a
            # second `completed` for one ID is malformed, not a re-completion.
            if aid in seen_completed_ids:
                raise AuditLogError(
                    f"line {line_no}: duplicate 'completed' event for {aid!r} — "
                    f"assignment IDs are never reused"
                )
            seen_completed_ids.add(aid)

        if kind == "sampled":
            if aid not in seen_completed_ids:
                raise AuditLogError(
                    f"line {line_no}: 'sampled' event for {aid!r} has no prior 'completed' "
                    f"event — an assignment cannot be sampled before it completes"
                )
            tok = AUDIT_TOKEN_RE.search(detail)
            if not tok:
                raise AuditLogError(
                    f"line {line_no}: 'sampled' event for {aid!r} has no `audit=<id>` token "
                    f"in Detail — without it no 'audited' event can be matched to it"
                )
            if tok.group(1) in closed_audit_tokens:
                raise AuditLogError(
                    f"line {line_no}: 'sampled' event for {aid!r} references audit "
                    f"{tok.group(1)!r}, which already completed — an assignment cannot be "
                    f"selected into an audit that is already closed"
                )
            open_audit_tokens.setdefault(tok.group(1), []).append(aid)

        if kind == "audited":
            tok = AUDIT_TOKEN_RE.search(detail)
            if not tok:
                raise AuditLogError(
                    f"line {line_no}: 'audited' event has no `audit=<id>` token in Detail — "
                    f"without it, it cannot clear any sampled assignment"
                )
            token = tok.group(1)
            if token in closed_audit_tokens:
                raise AuditLogError(
                    f"line {line_no}: audit {token!r} completed more than once — an audit "
                    f"token is closed exactly once"
                )
            if not open_audit_tokens.get(token):
                raise AuditLogError(
                    f"line {line_no}: 'audited' event for {token!r} has no preceding 'sampled' "
                    f"row carrying that token — an audit cannot complete before anything was "
                    f"selected into it"
                )
            closed_audit_tokens.add(token)

        if kind == "rate_changed":
            im = INTERVAL_RE.search(detail)
            if not im:
                raise AuditLogError(
                    f"line {line_no}: 'rate_changed' event has no `interval=<n>` token in "
                    f"Detail — a rate change that cannot be applied is worse than none"
                )
            if int(im.group(1)) < 1:
                raise AuditLogError(
                    f"line {line_no}: 'rate_changed' interval must be >= 1, got {im.group(1)}"
                )

        events.append(Event(line_no, event_date, kind, aid, route, detail))

    return events


@dataclass
class DueStatus:
    due: bool
    pending: list[tuple[int, str, date]]  # (ordinal, assignment_id, completed_date)
    interval: int
    reason: str


def compute_due_status(events: list[Event], today: date | None = None) -> DueStatus:
    today = today or date.today()

    # Walk sequentially: an assignment is cleared only when a *later* `audited` row
    # closes the audit token its `sampled` row named. parse_log has already rejected
    # the reversed and reused-token cases, so this is belt-and-braces — but it keeps
    # the clearing rule itself order-aware rather than relying on that validation.
    pending_by_token: dict[str, list[str]] = {}
    cleared_ids: set[str] = set()
    for e in events:
        if e.kind == "sampled":
            token = AUDIT_TOKEN_RE.search(e.detail).group(1)
            pending_by_token.setdefault(token, []).append(e.assignment_id)
        elif e.kind == "audited":
            token = AUDIT_TOKEN_RE.search(e.detail).group(1)
            cleared_ids.update(pending_by_token.pop(token, []))

    # Walk in document order so a rate change applies only to completions that
    # follow it — retroactive application would re-select historical ordinals.
    interval = DEFAULT_INTERVAL
    ordinal = 0
    pending: list[tuple[int, str, date]] = []

    for ev in events:
        if ev.kind == "rate_changed":
            interval = int(INTERVAL_RE.search(ev.detail).group(1))
            continue
        if ev.kind != "completed" or ev.route != "claude_only":
            continue
        ordinal += 1
        if ordinal % interval != 0:
            continue
        if ev.assignment_id in cleared_ids:
            continue
        pending.append((ordinal, ev.assignment_id, ev.event_date))

    if not pending:
        return DueStatus(False, [], interval, "no selected assignment is awaiting audit")

    if len(pending) >= PENDING_THRESHOLD:
        return DueStatus(
            True,
            pending,
            interval,
            f"{len(pending)} selected assignments are pending (threshold {PENDING_THRESHOLD})",
        )

    oldest = min(d for _, _, d in pending)
    age_days = (today - oldest).days
    if age_days >= STALE_DAYS:
        return DueStatus(
            True,
            pending,
            interval,
            f"oldest pending candidate is {age_days} days old (threshold {STALE_DAYS})",
        )

    return DueStatus(
        False,
        pending,
        interval,
        f"{len(pending)} pending, oldest is {age_days} days old — below both thresholds",
    )


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else Path("reviews/AUDIT-LOG.md")
    try:
        text = path.read_text()
    except OSError as exc:
        print(f"audit_due: cannot read {path}: {exc}", file=sys.stderr)
        return 2

    try:
        events = parse_log(text)
    except AuditLogError as exc:
        print(f"audit_due: malformed log — {exc}", file=sys.stderr)
        return 2

    status = compute_due_status(events)
    print("DUE" if status.due else "NOT_DUE")
    print(f"sampling interval: 1 in {status.interval}")
    print(f"reason: {status.reason}")
    for ordinal, aid, d in status.pending:
        print(f"  pending #{ordinal}: {aid} (completed {d.isoformat()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
