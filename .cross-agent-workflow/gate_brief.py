#!/usr/bin/env python3
"""Generate the pre-gate's brief mechanically from HANDOFF.md.

This is what "the brief is generated mechanically" in WORKFLOW.md's anti-laundering
section actually means: the primary does not write the gate's brief by hand. This
script parses the ``## Current assignment`` block and emits exactly the fields the
gate needs, verbatim. A hand-narrowed brief is detectable because it will not match
this script's output byte-for-byte.

Fails closed (non-zero exit, message on stderr, nothing on stdout) rather than
emitting a guessed or partial brief when HANDOFF.md is missing, the section can't be
found, or a required field is absent or a placeholder.

Stdlib only. No third-party dependencies.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SECTION_HEADING = "## Current assignment"
FIELD_RE = re.compile(r"^- \*\*(.+?)\*\*:\s?(.*)$")
PLACEHOLDER_VALUES = {"", "—", "-", "none yet", "none"}  # "—" is an em dash

REQUIRED_FIELDS = (
    "ID",
    "Objective",
    "Acceptance criteria",
    "Required verification",
    "Baseline commit",
    "Artifact under review",
)
CONTEXT_FIELDS = ("Scope exclusions",)


class GateBriefError(Exception):
    """Raised when a brief cannot be generated safely; the caller must fail closed."""


def parse_current_assignment(text: str) -> dict[str, str]:
    """Parse the ``## Current assignment`` block into a field->value dict.

    Stops at the next ``##`` heading or an HTML comment opener, matching the
    boundary the templates use for the 25-line cap and the blocked_on_user note.
    """
    lines = text.splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == SECTION_HEADING)
    except StopIteration:
        raise GateBriefError(f"no {SECTION_HEADING!r} heading found")

    fields: dict[str, str] = {}
    for line in lines[start + 1:]:
        stripped = line.strip()
        if stripped.startswith("## ") or stripped.startswith("<!--"):
            break
        m = FIELD_RE.match(stripped)
        if m:
            name, value = m.group(1).strip(), m.group(2).strip()
            if name in fields:
                raise GateBriefError(f"duplicate field {name!r} in {SECTION_HEADING}")
            fields[name] = value
    return fields


def is_placeholder(value: str) -> bool:
    return value.strip().lower() in PLACEHOLDER_VALUES


def generate_brief(handoff_text: str) -> str:
    fields = parse_current_assignment(handoff_text)

    missing = [f for f in REQUIRED_FIELDS if f not in fields]
    if missing:
        raise GateBriefError(f"missing required field(s): {', '.join(missing)}")

    placeholder = [f for f in REQUIRED_FIELDS if is_placeholder(fields[f])]
    if placeholder:
        raise GateBriefError(
            f"required field(s) still placeholder-valued (assignment not ready for a "
            f"gate): {', '.join(placeholder)}"
        )

    lines = ["# Gate brief", "", "Generated mechanically from HANDOFF.md — not written by the primary.", ""]
    for name in REQUIRED_FIELDS:
        lines.append(f"- **{name}**: {fields[name]}")
    for name in CONTEXT_FIELDS:
        if name in fields and not is_placeholder(fields[name]):
            lines.append(f"- **{name}**: {fields[name]}")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else Path("HANDOFF.md")
    try:
        text = path.read_text()
    except OSError as exc:
        print(f"gate_brief: cannot read {path}: {exc}", file=sys.stderr)
        return 1

    try:
        brief = generate_brief(text)
    except GateBriefError as exc:
        print(f"gate_brief: refusing to generate a brief — {exc}", file=sys.stderr)
        return 1

    sys.stdout.write(brief)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
