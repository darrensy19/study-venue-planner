#!/usr/bin/env python3
"""Deterministic typed-state reducer and role-aware context extractor for a review record.

This is the script "outside the model" that WORKFLOW.md's role- and state-aware
slicing section describes. It exists because "take the latest status line" is
provably wrong: after a primary records ``accepted``, the latest status line reads
``accepted`` — which means *awaiting reviewer confirmation*, not resolved. An LLM
skimming the file can make exactly that mistake; this script cannot, because it
never conflates the three status vocabularies (issuance / disposition /
resolution) and never guesses when it can't reduce cleanly.

Reduces each finding ID to one of:

    open
    primary_accepted | primary_rebutted | blocked_on_user
    reviewer_resolved | reviewer_unresolved | blocked_on_user

Fails open — raises FullReadRequired, reported as ``FULL_READ_REQUIRED: <reason>``
on stderr with exit 2 — rather than guessing, on: an unknown finding ID, a
duplicate issuance block, unknown status vocabulary (matched broadly first, then
validated, so an unrecognized word is rejected rather than silently skipped),
invalid ordering, or a reopening after terminal resolution.

**Idempotent re-verification is legal.** A later round may re-affirm an already
`resolved` finding as `resolved` again — real reviewers do this when the user
directs revisions after an APPROVE and the reviewer must confirm earlier fixes
survived the new work (see `fantasy-hoops/reviews/WF-002.md` round 3). What stays
rejected after a terminal `resolved`: any disposition (a reopening), or a
*changed* resolution such as `unresolved` or `blocked_on_user`.

**Both issuance heading styles are accepted.** The template prescribes a
backticked ID; the real corpus contains both backticked and bare forms. Rejecting
the bare form would fail open on a third of real records — safe, but it would
defeat the extractor's entire purpose on those files.

**Factual assessment vs. action disposition.** A disposition block may optionally
carry a ``Factual assessment`` field (``confirmed | refuted | partial``), distinct
from the ``accepted | rebutted | blocked_on_user`` on its heading — what
independent verification established, versus what the primary decided to do
about it. The field is optional for backward compatibility (no real corpus
record predates it), but when present it must agree with the disposition:
``rebutted`` requires ``refuted``, and ``accepted`` rejects ``refuted``. This is
the deterministic proxy for "a rebuttal never treats a claim as fact without
evidence" — it cannot verify the evidence itself, but it rejects the
self-contradictory labeling that would otherwise pass silently.

Stdlib only.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Every pattern here matches broadly and validates afterwards. A pattern that only
# matched already-valid values would let malformed content fail to match and be
# silently skipped, which is the same defect three times over: unknown disposition
# words, unknown resolution words, and unknown severities each shipped that way.
#
# Backticks around the ID are optional — the template prescribes them, the real
# corpus contains both forms.
# "Finding-shaped" = three ` — ` segments whose middle one is a real severity.
# That is precise enough to catch a legacy or malformed finding heading whose ID
# cannot be parsed, without touching the non-ID dispositions that legitimately
# appear under a "User-directed revision dispositions" section (two segments,
# ending in a disposition word) — `fantasy-hoops/reviews/WF-002.md:349` is that case.
FINDING_SHAPED_RE = re.compile(r"^#### (.+?) — (\w+) — .+$")
# Issuance has two ` — ` separators: ID — severity — title.
ISSUANCE_RE = re.compile(r"^#### `?([A-Z]+-\d{3}-R\d+-F\d{2})`? — (.+?) — .+$")
# Disposition has one, and its value is a single word anchored to end of line —
# which is what keeps it from also matching an issuance heading.
DISPOSITION_HEADING_RE = re.compile(r"^#### `?([A-Z]+-\d{3}-R\d+-F\d{2})`? — `?(\w+)`?\s*$")
STATUS_AT_ISSUANCE_RE = re.compile(r"^- \*\*Status at issuance\*\*:\s*`?(\w+)`?\s*$")
RESOLUTION_ROW_RE = re.compile(r"^\|\s*`?([A-Z]+-\d{3}-R\d+-F\d{2})`?\s*\|\s*`?(\w+)`?\s*\|")
# Optional — every real corpus record predates this field, so its absence is not
# an error. When present it must agree with the disposition heading: see the
# cross-check below.
FACTUAL_ASSESSMENT_RE = re.compile(r"^- \*\*Factual assessment\*\*:\s*`?(\w+)`?")

VALID_SEVERITIES = {"Critical", "High", "Medium", "Low"}

SECTION_HEADING_RE = re.compile(r"^#{1,4} ")
ROUND_HEADING_RE = re.compile(r"^## (Review round|Primary response to review round) (\d+)")
ASSIGNMENT_HEADING_RE = re.compile(r"^## Assignment\s*$")

NAMED_SECTIONS = {
    "### Could not verify": "could_not_verify",
    "### User decisions required": "user_decisions",
    "### Recommendation": "recommendation",
    "### Non-blocking observations": "non_blocking",
    "### User-directed revisions": "user_directed_revisions",
    "### Verification performed": "verification_performed",
}

VALID_DISPOSITIONS = {"accepted", "rebutted", "blocked_on_user"}
VALID_RESOLUTIONS = {"resolved", "unresolved", "blocked_on_user"}
VALID_FACTUAL_ASSESSMENTS = {"confirmed", "refuted", "partial"}
TERMINAL_RESOLUTION = "resolved"

ACTORS = ("primary-correction", "reviewer-round2", "reconciliation", "all")


class FullReadRequired(Exception):
    """Raised when the document cannot be reduced safely. Message is the reason."""


@dataclass
class FindingEvents:
    finding_id: str
    issuance_line: int
    issuance_block: str = ""
    # (line_number, kind, value) in document order
    events: list[tuple[int, str, str]] = field(default_factory=list)
    disposition_blocks: list[str] = field(default_factory=list)
    resolution_rows: list[str] = field(default_factory=list)


@dataclass
class Document:
    findings: dict[str, FindingEvents] = field(default_factory=dict)
    assignment_header: str = ""
    # section key -> list of (round_label, block), in document order
    sections: dict[str, list[tuple[str, str]]] = field(default_factory=dict)
    last_review_round: str = ""
    last_primary_response: str = ""


def _block(lines: list[str], start: int) -> tuple[str, int]:
    """Text from lines[start] up to (not including) the next heading, plus the
    index of the first line after the block."""
    j = start + 1
    while j < len(lines) and not SECTION_HEADING_RE.match(lines[j]):
        j += 1
    return "\n".join(lines[start:j]), j


def _round_block(lines: list[str], start: int) -> str:
    """Text of a whole round: from its `## ` heading to the next `## ` heading."""
    j = start + 1
    while j < len(lines) and not lines[j].startswith("## "):
        j += 1
    return "\n".join(lines[start:j])


def parse(text: str) -> dict[str, str]:
    """Parse a review record and return {finding_id: reduced_state}."""
    doc = parse_document(text)
    return {fid: _reduce(fe) for fid, fe in doc.findings.items()}


def parse_document(text: str) -> Document:
    lines = text.splitlines()
    doc = Document()
    current_round = "(no round heading)"

    i = 0
    while i < len(lines):
        line = lines[i]

        rm = ROUND_HEADING_RE.match(line)
        if rm:
            current_round = line.strip().lstrip("# ").strip()
            block = _round_block(lines, i)
            if rm.group(1) == "Review round":
                doc.last_review_round = block
            else:
                doc.last_primary_response = block
            i += 1
            continue

        if ASSIGNMENT_HEADING_RE.match(line):
            doc.assignment_header, i = _block(lines, i)
            continue

        stripped_heading = line.strip()
        if stripped_heading in NAMED_SECTIONS:
            key = NAMED_SECTIONS[stripped_heading]
            block, next_i = _block(lines, i)
            doc.sections.setdefault(key, []).append((current_round, block))
            i = next_i
            continue

        m = ISSUANCE_RE.match(line)
        if m:
            fid, severity = m.group(1), m.group(2).strip().strip("`")
            if severity not in VALID_SEVERITIES:
                raise FullReadRequired(
                    f"{fid} issuance at line {i + 1} has unknown severity {severity!r} — "
                    f"expected one of {', '.join(sorted(VALID_SEVERITIES))}"
                )
            if fid in doc.findings:
                raise FullReadRequired(f"duplicate issuance block for {fid} at line {i + 1}")
            block, next_i = _block(lines, i)
            statuses = [
                sm.group(1)
                for sm in (STATUS_AT_ISSUANCE_RE.match(bl.strip()) for bl in block.splitlines())
                if sm
            ]
            if not statuses:
                raise FullReadRequired(
                    f"{fid} issuance at line {i + 1} has no 'Status at issuance' field"
                )
            if statuses[0] != "open":
                raise FullReadRequired(
                    f"{fid} issuance at line {i + 1} declares status {statuses[0]!r}, "
                    f"expected 'open' — unknown vocabulary"
                )
            doc.findings[fid] = FindingEvents(
                finding_id=fid, issuance_line=i + 1, issuance_block=block
            )
            i = next_i
            continue

        m = DISPOSITION_HEADING_RE.match(line)
        if m:
            fid, disposition = m.group(1), m.group(2)
            if fid not in doc.findings:
                raise FullReadRequired(
                    f"disposition for {fid} at line {i + 1} references a finding ID "
                    f"never issued in this document"
                )
            if disposition not in VALID_DISPOSITIONS:
                raise FullReadRequired(
                    f"{fid} disposition at line {i + 1} has unknown value {disposition!r}"
                )
            block, next_i = _block(lines, i)
            fa_matches = [
                fam.group(1)
                for fam in (FACTUAL_ASSESSMENT_RE.match(bl.strip()) for bl in block.splitlines())
                if fam
            ]
            if len(fa_matches) > 1:
                raise FullReadRequired(
                    f"{fid} disposition at line {i + 1} has {len(fa_matches)} 'Factual "
                    f"assessment' fields — expected at most one, not "
                    f"{', '.join(repr(f) for f in fa_matches)}"
                )
            if fa_matches:
                factual = fa_matches[0]
                if factual not in VALID_FACTUAL_ASSESSMENTS:
                    raise FullReadRequired(
                        f"{fid} disposition at line {i + 1} has unknown factual assessment "
                        f"{factual!r} — expected one of "
                        f"{', '.join(sorted(VALID_FACTUAL_ASSESSMENTS))}"
                    )
                if disposition == "rebutted" and factual != "refuted":
                    raise FullReadRequired(
                        f"{fid} disposition at line {i + 1} is `rebutted` with factual "
                        f"assessment {factual!r} — a rebuttal requires a `refuted` factual "
                        f"assessment backed by the independent verification evidence, never a "
                        f"bare counterclaim"
                    )
                if disposition == "accepted" and factual == "refuted":
                    raise FullReadRequired(
                        f"{fid} disposition at line {i + 1} is `accepted` with factual "
                        f"assessment `refuted` — a refuted finding cannot also be accepted"
                    )
            doc.findings[fid].events.append((i + 1, "disposition", disposition))
            doc.findings[fid].disposition_blocks.append(block)
            i = next_i
            continue

        m = RESOLUTION_ROW_RE.match(line)
        if m:
            fid, resolution = m.group(1), m.group(2)
            if fid not in doc.findings:
                raise FullReadRequired(
                    f"resolution for {fid} at line {i + 1} references a finding ID "
                    f"never issued in this document"
                )
            if resolution not in VALID_RESOLUTIONS:
                raise FullReadRequired(
                    f"{fid} resolution at line {i + 1} has unknown value {resolution!r}"
                )
            doc.findings[fid].events.append((i + 1, "resolution", resolution))
            doc.findings[fid].resolution_rows.append(line.strip())
            i += 1
            continue

        shaped = FINDING_SHAPED_RE.match(line)
        if shaped and shaped.group(2).strip("`") in VALID_SEVERITIES:
            # Finding-shaped, but neither ISSUANCE_RE nor DISPOSITION_HEADING_RE
            # claimed it — so its ID is missing or in a format this reducer cannot
            # parse. Failing open beats vanishing: `fantasy-hoops/reviews/WF-001.md`
            # uses pre-stable-ID `Finding N` headings and previously reduced to
            # "No findings." while the record actually held four.
            raise FullReadRequired(
                f"line {i + 1}: finding-shaped `####` heading with an unparseable "
                f"finding ID — expected `<PREFIX>-<NNN>-R<n>-F<NN>`: {line.strip()!r}"
            )

        i += 1

    # Validate every finding eagerly, so a malformed document fails even for
    # findings the caller never queries individually.
    for fe in doc.findings.values():
        _reduce(fe)

    return doc


def _reduce(fe: FindingEvents) -> str:
    if not fe.events:
        return "open"

    expected = "disposition"
    terminal = False
    last_kind = last_value = None

    for line_no, kind, value in fe.events:
        if terminal:
            # Idempotent re-verification is legal: a later round may re-affirm
            # `resolved` as `resolved`. Anything else after a terminal resolution
            # is a reopening or a contradiction, and fails open.
            if kind == "resolution" and value == TERMINAL_RESOLUTION:
                continue
            raise FullReadRequired(
                f"{fe.finding_id} has a {kind} of {value!r} at line {line_no} after a "
                f"`resolved` resolution — only an idempotent `resolved` re-verification "
                f"may follow a terminal resolution"
            )
        if kind != expected:
            raise FullReadRequired(
                f"{fe.finding_id} has a {kind} at line {line_no} where a {expected} "
                f"was expected — invalid ordering (disposition and resolution must "
                f"strictly alternate)"
            )
        last_kind, last_value = kind, value
        if kind == "disposition":
            expected = "resolution"
        else:
            expected = "disposition"
            if value == TERMINAL_RESOLUTION:
                terminal = True

    if last_kind == "disposition":
        return "blocked_on_user" if last_value == "blocked_on_user" else f"primary_{last_value}"
    return "blocked_on_user" if last_value == "blocked_on_user" else f"reviewer_{last_value}"


TERMINAL_STATES = {"reviewer_resolved"}


def _latest(doc: Document, key: str) -> str | None:
    entries = doc.sections.get(key)
    return entries[-1][1] if entries else None


def _all_blocks(doc: Document, key: str) -> list[tuple[str, str]]:
    return doc.sections.get(key, [])


def emit_chunks(text: str, actor: str = "all") -> str:
    """Emit the role- and state-aware slice WORKFLOW.md's table requires.

    Only the review-record portions are emitted — the diff, HANDOFF.md and the
    governing contract sections are the caller's responsibility, since this
    script only ever sees one file.
    """
    if actor not in ACTORS:
        raise FullReadRequired(f"unknown actor {actor!r}; expected one of {', '.join(ACTORS)}")

    doc = parse_document(text)
    states = {fid: _reduce(fe) for fid, fe in doc.findings.items()}
    out: list[str] = []

    if actor == "reconciliation":
        # "Latest recommendation and current handoff only" — handoff is the
        # caller's to supply.
        rec = _latest(doc, "recommendation")
        if not rec:
            raise FullReadRequired("no '### Recommendation' section found")
        out.append(rec)
        return "\n".join(out) + "\n"

    if actor == "primary-correction":
        # "Latest review round; complete finding blocks"
        if not doc.last_review_round:
            raise FullReadRequired("no '## Review round N' heading found")
        out.append(doc.last_review_round)
        out.append("\n## Finding states (reduced)\n")
        for fid in sorted(states):
            out.append(f"- `{fid}`: {states[fid]}")
        return "\n".join(out) + "\n"

    # reviewer-round2 and all
    if not doc.assignment_header:
        raise FullReadRequired("no '## Assignment' header found")
    out.append(doc.assignment_header)

    out.append("\n## Findings (reduced)\n")
    for fid in sorted(states):
        fe = doc.findings[fid]
        if states[fid] in TERMINAL_STATES:
            out.append(f"- `{fid}`: {states[fid]} (terminal — full block omitted)")
        else:
            out.append(fe.issuance_block)
            out.extend(fe.disposition_blocks)
            if fe.resolution_rows:
                out.append("\nResolution evidence:")
                out.extend(fe.resolution_rows)
            out.append(f"(reduced state: `{states[fid]}`)\n")

    if actor == "reviewer-round2" and doc.last_primary_response:
        out.append("\n## Latest primary response\n")
        out.append(doc.last_primary_response)

    for key, label in (
        ("non_blocking", "Non-blocking observations (no IDs — none can be marked resolved)"),
        ("user_directed_revisions", "User-directed revisions"),
        ("could_not_verify", "Latest Could not verify"),
        ("user_decisions", "Latest User decisions required"),
        ("recommendation", "Latest Recommendation"),
    ):
        if key in ("non_blocking", "user_directed_revisions"):
            blocks = _all_blocks(doc, key)
            if blocks:
                out.append(f"\n## {label}\n")
                for round_label, block in blocks:
                    out.append(f"_from {round_label}_\n")
                    out.append(block)
        else:
            block = _latest(doc, key)
            if block:
                out.append(f"\n## {label}\n")
                out.append(block)

    return "\n".join(out) + "\n"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(
            "usage: finding_state.py <reviews/ID.md> [--emit-chunks [--actor <name>]]\n"
            f"  actors: {', '.join(ACTORS)}",
            file=sys.stderr,
        )
        return 2

    path = Path(argv[1])
    rest = argv[2:]
    emit = "--emit-chunks" in rest
    actor = "all"
    if "--actor" in rest:
        if not emit:
            # Silently ignoring it would hand back reduced states while the caller
            # believed it had asked for a slice.
            print(
                "finding_state: --actor requires --emit-chunks; without it only reduced "
                "states are printed and the actor would be silently ignored",
                file=sys.stderr,
            )
            return 2
        idx = rest.index("--actor")
        if idx + 1 >= len(rest):
            print("finding_state: --actor requires a value", file=sys.stderr)
            return 2
        actor = rest[idx + 1]

    try:
        text = path.read_text()
    except OSError as exc:
        print(f"finding_state: cannot read {path}: {exc}", file=sys.stderr)
        return 2

    try:
        if emit:
            sys.stdout.write(emit_chunks(text, actor))
            return 0
        states = parse(text)
    except FullReadRequired as exc:
        print(f"FULL_READ_REQUIRED: {exc}", file=sys.stderr)
        return 2

    if not states:
        print("No findings.")
        return 0

    for fid in sorted(states):
        print(f"{fid}\t{states[fid]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
