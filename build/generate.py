"""The fixture-driven HTML generator — Phase 1 step 6 (`PLAN.md`, "Frontend:
plain HTML, no framework" / "The generated page is self-contained").

Merges `data/venues.json` (generated) with `data/venues_meta.json`
(hand-maintained) by `id`, then inlines the merged venue list, holidays and
the seat log alongside `ranking.js` + `app.js` (concatenated into one module
script, per "The module inlining contract") and `style.css` into
`web/index.template.html`, producing the self-contained `web/index.html`.

Orchestrated by `build/refresh.py` (step 8, after the atomic replace) and,
independently, by `make generate` below — a no-network target that
regenerates the page from whatever `data/venues.json` already holds on disk.
Independently testable against fixtures either way; touches no network.
"""

import csv
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

IMPORT_LINE_PATTERN = re.compile(
    r'^import \{[^}]*\} from "\./ranking\.js";\n?', re.MULTILINE
)
TOP_LEVEL_DECL_PATTERN = re.compile(
    r"^(?:export\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
DATA_SCRIPT_IDS = ("data-venues", "data-holidays", "data-seatlog")
PLACEHOLDERS = (
    "{{DATA_VENUES}}",
    "{{DATA_HOLIDAYS}}",
    "{{DATA_SEATLOG}}",
    "{{MODULE_SCRIPT}}",
    "{{STYLE}}",
)


class GenerationError(Exception):
    """The generation contract was violated: an id mismatch between the
    generated venues and the hand-maintained meta, a malformed template, a
    top-level name collision between `ranking.js` and `app.js`, a missing
    hand-maintained input, or a generated artifact that fails its own
    structural assertions. Never partially applied — no file is written when
    this is raised.
    """


def merge_venues(generated_venues, venues_meta):
    """Merge each generated venue record with its hand-maintained meta entry
    by `id`. Generated fields win on a name collision — they are the
    fresher, authoritative side (`business_status`, hours,
    `return_transport_status`) — though no field is expected on both sides
    in practice.

    An id mismatch in either direction is a generation contract failure
    (`PLAN.md`, "An ID mismatch between the two files is a generation
    contract failure, not a runtime condition"), never a partial merge.
    """
    generated_ids = {v["id"] for v in generated_venues}
    meta_ids = set(venues_meta)

    missing_meta = generated_ids - meta_ids
    missing_generated = meta_ids - generated_ids
    if missing_meta or missing_generated:
        problems = []
        if missing_meta:
            problems.append(f"generated venue(s) with no meta entry: {sorted(missing_meta)}")
        if missing_generated:
            problems.append(f"meta entr(y/ies) with no generated venue: {sorted(missing_generated)}")
        raise GenerationError("venues/meta id mismatch — " + "; ".join(problems))

    return [{**venues_meta[v["id"]], **v} for v in generated_venues]


def to_embedded_json(data):
    """Serialise `data` for a `<script type="application/json">` block,
    escaping every `<` as its six-character JSON unicode escape so a value
    containing `</script>` can never terminate the block (`PLAN.md`,
    "Escaping embedded JSON"). A JSON-level escape, not an HTML one — HTML
    entities are not decoded inside `<script>`.
    """
    return json.dumps(data).replace("<", "\\u003c")


def strip_app_import(app_js_text):
    """Remove `app.js`'s single fixed-form `import` line so the concatenated
    module has no module graph (`PLAN.md`, "The module inlining contract").
    Fails loudly if that exact line isn't present, rather than silently
    emitting an `app.js` that still imports at runtime.
    """
    if not IMPORT_LINE_PATTERN.search(app_js_text):
        raise GenerationError(
            'app.js does not start with the fixed-form import { ... } from "./ranking.js"; line'
        )
    return IMPORT_LINE_PATTERN.sub("", app_js_text, count=1)


def _top_level_names(js_text):
    return {m.group(1) for m in TOP_LEVEL_DECL_PATTERN.finditer(js_text)}


def check_no_top_level_collisions(ranking_js_text, app_js_text):
    """`ranking.js` and `app.js` share one top-level module scope once
    concatenated, so their top-level declarations must not collide
    (`PLAN.md`, "The module inlining contract").
    """
    collisions = _top_level_names(ranking_js_text) & _top_level_names(app_js_text)
    if collisions:
        raise GenerationError(
            f"top-level name collision between ranking.js and app.js: {sorted(collisions)}"
        )


def build_module_script(ranking_js_text, app_js_text):
    """One `<script type="module">` body: `ranking.js` in full, then
    `app.js` with its import line removed, sharing one top-level scope.
    """
    check_no_top_level_collisions(ranking_js_text, app_js_text)
    stripped_app = strip_app_import(app_js_text)
    return ranking_js_text.rstrip("\n") + "\n\n" + stripped_app


def render_page(
    *,
    template_text,
    merged_venues,
    holidays,
    seatlog_rows,
    ranking_js_text,
    app_js_text,
    style_css_text,
):
    """Pure core: substitute every placeholder in `template_text`. Takes text
    content rather than paths so it is fixture-testable with no filesystem
    or network access — `generate_index_html` below is the thin I/O wrapper.
    """
    missing = [p for p in PLACEHOLDERS if p not in template_text]
    if missing:
        raise GenerationError(f"template missing placeholder(s): {missing}")

    substitutions = {
        "{{DATA_VENUES}}": to_embedded_json(merged_venues),
        "{{DATA_HOLIDAYS}}": to_embedded_json(holidays),
        "{{DATA_SEATLOG}}": to_embedded_json(seatlog_rows),
        "{{MODULE_SCRIPT}}": build_module_script(ranking_js_text, app_js_text),
        "{{STYLE}}": style_css_text,
    }
    html_text = template_text
    for placeholder, value in substitutions.items():
        html_text = html_text.replace(placeholder, value)
    return html_text


class _ArtifactParser(HTMLParser):
    """Collects exactly what `validate_generated_artifact` needs: every
    external `src=`/`href=` reference, the module script's text, each
    `application/json` data block's text (by id), and the stylesheet text.
    """

    def __init__(self):
        super().__init__()
        self.external_refs = []  # (tag, attr, value)
        self.module_script_text = None
        self.json_scripts = {}
        self.style_text = None
        self._capturing = None
        self._buffer = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style"):
            self._capturing = (tag, attrs)
            self._buffer = []
        for attr in ("src", "href"):
            if attrs.get(attr):
                self.external_refs.append((tag, attr, attrs[attr]))

    def handle_data(self, data):
        if self._capturing is not None:
            self._buffer.append(data)

    def handle_endtag(self, tag):
        if self._capturing is not None and self._capturing[0] == tag:
            tag_name, attrs = self._capturing
            text = "".join(self._buffer)
            if tag_name == "script":
                script_type = attrs.get("type")
                if script_type == "module":
                    self.module_script_text = text
                elif script_type == "application/json" and attrs.get("id") in DATA_SCRIPT_IDS:
                    self.json_scripts[attrs["id"]] = text
            elif tag_name == "style":
                self.style_text = text
            self._capturing = None
            self._buffer = []


def validate_generated_artifact(html_text):
    """Structural assertions against the generated page itself (`PLAN.md`,
    "Generated-artifact acceptance"). Covers everything checkable without
    executing JavaScript. The `file://` / iPhone rendering checks and the
    runtime-computed removal-notice rendering stay on the manual acceptance
    checklist — no headless-DOM test runtime is set up in this repo (see
    `DECISIONS.md`, the IMP-012 close entry).
    """
    parser = _ArtifactParser()
    parser.feed(html_text)

    if parser.module_script_text is None:
        raise GenerationError('no <script type="module"> block in the generated page')
    module_text = parser.module_script_text
    if "import " in module_text or 'from "./' in module_text or "from './" in module_text:
        raise GenerationError("an unresolved local import survives in the emitted module")
    if "fetch(" in module_text:
        raise GenerationError(
            "fetch() present in the emitted module — bundled data must be read from the DOM only"
        )

    if not parser.style_text or not parser.style_text.strip():
        raise GenerationError("no non-empty <style> block in the generated page")

    for script_id in DATA_SCRIPT_IDS:
        if script_id not in parser.json_scripts:
            raise GenerationError(f'missing <script type="application/json" id="{script_id}">')
        try:
            json.loads(parser.json_scripts[script_id])
        except json.JSONDecodeError as exc:
            raise GenerationError(f"{script_id} block is not valid JSON: {exc}") from exc

    external = parser.external_refs
    if any(tag == "script" for tag, _, _ in external):
        raise GenerationError("an external <script src=...> reference survives in the generated page")
    if any(
        tag == "link" and value.rstrip().lower().endswith(".css")
        for tag, _, value in external
    ):
        raise GenerationError(
            'an external <link rel="stylesheet"> reference survives in the generated page'
        )
    if len(external) > 1:
        raise GenerationError(f"more than one external reference in the generated page: {external}")
    non_manifest = [r for r in external if not r[2].endswith(".webmanifest")]
    if non_manifest:
        raise GenerationError(f"unexpected external reference(s): {non_manifest}")
    for tag, attr, value in external:
        if value.startswith("/") and not value.startswith("//"):
            raise GenerationError(f'absolute path in generated page: <{tag} {attr}="{value}">')

    venues = json.loads(parser.json_scripts["data-venues"])
    missing_status = [v.get("id", "<no id>") for v in venues if "return_transport_status" not in v]
    if missing_status:
        raise GenerationError(f"venue(s) missing return_transport_status: {missing_status}")


def _read_seatlog(path):
    if not path.exists():
        return []
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def generate_index_html(
    *,
    venues_path,
    venues_meta_path,
    holidays_path,
    seatlog_path,
    template_path,
    ranking_js_path,
    app_js_path,
    style_css_path,
    output_path,
):
    """Thin I/O wrapper around `render_page`: reads every input from disk,
    merges, renders, validates the result, and writes `output_path`. Never
    partially applied — a `GenerationError` at any step leaves `output_path`
    untouched. `holidays.json` must exist and parse (`PLAN.md`'s testing
    section: "holidays.json absent or malformed failing generation
    visibly"); `seatlog.csv` may legitimately not exist yet — Phase 2 (the
    only writer of real rows) hasn't started — so its absence defaults to no
    rows rather than failing.

    `venues_path` is the `data/venues.json` wrapper object — `{"hours_timezone":
    ..., "histogram_timezone": ..., "venues": [...]}` (`PLAN.md`, "data/venues.json
    — generated, never hand-edited") — never a bare venue array. `build/refresh.py`
    and `build/coarsen.py` both read and write that same wrapper shape; a bare
    array here is a malformed input, not an alternate accepted form, and the two
    timezone fields are preserved on disk (this function only reads `venues_path`,
    never rewrites it) even though nothing in the generated page currently
    consumes them.
    """
    venues_path = Path(venues_path)
    venues_meta_path = Path(venues_meta_path)
    holidays_path = Path(holidays_path)
    seatlog_path = Path(seatlog_path)
    template_path = Path(template_path)
    ranking_js_path = Path(ranking_js_path)
    app_js_path = Path(app_js_path)
    style_css_path = Path(style_css_path)
    output_path = Path(output_path)

    if not holidays_path.exists():
        raise GenerationError(f"holidays.json is required and was not found at {holidays_path}")
    try:
        holidays = json.loads(holidays_path.read_text())
    except json.JSONDecodeError as exc:
        raise GenerationError(f"holidays.json at {holidays_path} is malformed: {exc}") from exc

    venues_payload = json.loads(venues_path.read_text())
    if not isinstance(venues_payload, dict):
        raise GenerationError(
            f"{venues_path} must be the venues.json wrapper object "
            '({"hours_timezone": ..., "histogram_timezone": ..., "venues": [...]}), '
            "not a bare array"
        )
    generated_venues = venues_payload.get("venues")
    if not isinstance(generated_venues, list):
        raise GenerationError(f'{venues_path} is missing a "venues" list')

    venues_meta = json.loads(venues_meta_path.read_text())
    seatlog_rows = _read_seatlog(seatlog_path)

    merged = merge_venues(generated_venues, venues_meta)

    html_text = render_page(
        template_text=template_path.read_text(),
        merged_venues=merged,
        holidays=holidays,
        seatlog_rows=seatlog_rows,
        ranking_js_text=ranking_js_path.read_text(),
        app_js_text=app_js_path.read_text(),
        style_css_text=style_css_path.read_text(),
    )
    validate_generated_artifact(html_text)
    output_path.write_text(html_text)


def main(*, data_dir=None, web_dir=None):
    """`make generate`'s entry point — regenerates `web/index.html` from
    whatever `data/venues.json` already holds on disk, spending zero API
    calls (`PLAN.md`, "Decision 18" / "Phase 1 review-response slice order",
    slice 0). Accepts `data_dir`/`web_dir` overrides for testability,
    mirroring `build/refresh.py`'s `refresh()` signature; a real invocation
    supplies neither and uses this repo's actual `data/` and `web/`.

    Returns an exit code rather than raising, so `__main__` below can be a
    one-line `sys.exit(main())` — the CLI failure mode is a clean stderr
    message and a nonzero exit, not a Python traceback.
    """
    repo_root = Path(__file__).resolve().parent.parent
    data_dir = Path(data_dir) if data_dir is not None else repo_root / "data"
    web_dir = Path(web_dir) if web_dir is not None else repo_root / "web"

    try:
        generate_index_html(
            venues_path=data_dir / "venues.json",
            venues_meta_path=data_dir / "venues_meta.json",
            holidays_path=data_dir / "holidays.json",
            seatlog_path=data_dir / "seatlog.csv",
            template_path=web_dir / "index.template.html",
            ranking_js_path=web_dir / "ranking.js",
            app_js_path=web_dir / "app.js",
            style_css_path=web_dir / "style.css",
            output_path=web_dir / "index.html",
        )
    except GenerationError as exc:
        print(f"generate: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote {web_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
