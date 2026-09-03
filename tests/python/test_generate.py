"""Phase 1 step 6 — the fixture-driven HTML generator (`build/generate.py`).

Fixture-based per `CLAUDE.md`'s testing conventions; touches no network. The
merge and its ID-mismatch failure live here because the merge happens here
(`PLAN.md`, "Where the merge's tests live").
"""

from pathlib import Path

import pytest

from build.generate import (
    GenerationError,
    build_module_script,
    check_no_top_level_collisions,
    generate_index_html,
    merge_venues,
    render_page,
    strip_app_import,
    to_embedded_json,
    validate_generated_artifact,
)

FIXTURES = Path(__file__).parent / "fixtures" / "generate"

RANKING_STUB = 'export function rankVenues(snapshot, controls) {\n  return { planA: null };\n}\n'
APP_STUB = (
    'import { rankVenues } from "./ranking.js";\n'
    "\n"
    "const result = rankVenues({ venues: [], holidays: {} }, {});\n"
)
STYLE_STUB = "body { margin: 0; }\n"


def _venue(id_, **fields):
    return {"id": id_, "business_status": "OPERATIONAL", **fields}


def _meta(**fields):
    return {"brand": "starbucks", "area": "Orchard", "preference": 1, **fields}


# --- merge_venues ------------------------------------------------------------


def test_merge_venues_combines_fields_from_both_sides():
    generated = [_venue("a", return_transport_status={"state": "ok"})]
    meta = {"a": _meta(baseline_seatability="dependable")}

    merged = merge_venues(generated, meta)

    assert merged == [
        {
            "id": "a",
            "business_status": "OPERATIONAL",
            "return_transport_status": {"state": "ok"},
            "brand": "starbucks",
            "area": "Orchard",
            "preference": 1,
            "baseline_seatability": "dependable",
        }
    ]


def test_merge_venues_generated_field_wins_on_collision():
    generated = [_venue("a", area="generated-side-area")]
    meta = {"a": _meta(area="meta-side-area")}

    merged = merge_venues(generated, meta)

    assert merged[0]["area"] == "generated-side-area"


def test_merge_venues_fails_on_generated_venue_with_no_meta_entry():
    generated = [_venue("a"), _venue("b")]
    meta = {"a": _meta()}

    with pytest.raises(GenerationError, match="b"):
        merge_venues(generated, meta)


def test_merge_venues_fails_on_meta_entry_with_no_generated_venue():
    generated = [_venue("a")]
    meta = {"a": _meta(), "orphan": _meta()}

    with pytest.raises(GenerationError, match="orphan"):
        merge_venues(generated, meta)


def test_merge_venues_fails_on_mismatch_in_both_directions_at_once():
    generated = [_venue("a"), _venue("only-generated")]
    meta = {"a": _meta(), "only-meta": _meta()}

    with pytest.raises(GenerationError, match="only-generated") as exc_info:
        merge_venues(generated, meta)
    assert "only-meta" in str(exc_info.value)


# --- to_embedded_json ---------------------------------------------------------


def test_to_embedded_json_escapes_ordinary_less_than():
    escape = "\\" + "u003c"  # the six-character JSON unicode escape for "<"
    assert to_embedded_json({"notes": "a < b"}) == '{"notes": "a ' + escape + ' b"}'


def test_to_embedded_json_round_trips_a_value_containing_script_close_tag():
    import json

    original = {"notes": "see </script><script>alert(1)</script>"}

    embedded = to_embedded_json(original)

    assert "</script>" not in embedded
    assert json.loads(embedded) == original


# --- strip_app_import ---------------------------------------------------------


def test_strip_app_import_removes_the_fixed_form_import_line():
    stripped = strip_app_import(APP_STUB)

    assert "import" not in stripped
    assert 'const result = rankVenues' in stripped


def test_strip_app_import_fails_loudly_when_the_import_line_is_missing():
    with pytest.raises(GenerationError):
        strip_app_import("const x = 1;\n")


# --- check_no_top_level_collisions -------------------------------------------


def test_check_no_top_level_collisions_passes_when_disjoint():
    check_no_top_level_collisions(RANKING_STUB, APP_STUB)  # must not raise


def test_check_no_top_level_collisions_fails_on_a_shared_top_level_name():
    ranking = "export const state = 1;\n"
    app = 'import { rankVenues } from "./ranking.js";\nlet state = 2;\n'

    with pytest.raises(GenerationError, match="state"):
        check_no_top_level_collisions(ranking, app)


def test_check_no_top_level_collisions_passes_for_the_real_project_files():
    ranking_js = (Path(__file__).parent.parent.parent / "web" / "ranking.js").read_text()
    app_js = (Path(__file__).parent.parent.parent / "web" / "app.js").read_text()

    check_no_top_level_collisions(ranking_js, app_js)  # must not raise


# --- build_module_script -------------------------------------------------------


def test_build_module_script_concatenates_with_import_stripped():
    script = build_module_script(RANKING_STUB, APP_STUB)

    assert "export function rankVenues" in script
    assert "const result = rankVenues" in script
    assert 'import { rankVenues } from "./ranking.js";' not in script


def test_build_module_script_fails_on_collision_before_concatenating():
    with pytest.raises(GenerationError):
        build_module_script("export const state = 1;\n", 'import { rankVenues } from "./ranking.js";\nlet state = 2;\n')


# --- render_page ---------------------------------------------------------------


def _render(**overrides):
    kwargs = dict(
        template_text=(FIXTURES / "template.html").read_text(),
        merged_venues=[_venue("a", return_transport_status={"state": "ok"}, **_meta())],
        holidays={"2026-12-25": "Christmas"},
        seatlog_rows=[],
        ranking_js_text=RANKING_STUB,
        app_js_text=APP_STUB,
        style_css_text=STYLE_STUB,
    )
    kwargs.update(overrides)
    return render_page(**kwargs)


def test_render_page_substitutes_every_placeholder():
    html_text = _render()

    assert "{{" not in html_text
    assert "}}" not in html_text
    assert "Christmas" in html_text
    assert "body { margin: 0; }" in html_text
    assert "export function rankVenues" in html_text


def test_render_page_fails_on_a_template_missing_a_placeholder():
    with pytest.raises(GenerationError, match="STYLE"):
        _render(template_text="<html>{{DATA_VENUES}}{{DATA_HOLIDAYS}}{{DATA_SEATLOG}}{{MODULE_SCRIPT}}</html>")


# --- validate_generated_artifact ------------------------------------------------


def test_validate_generated_artifact_passes_on_a_well_formed_page():
    validate_generated_artifact(_render())  # must not raise


def test_validate_generated_artifact_fails_on_malformed_embedded_json():
    broken = _render().replace('{"id": "a"', '{"id": "a"  BROKEN')

    with pytest.raises(GenerationError):
        validate_generated_artifact(broken)


def test_validate_generated_artifact_fails_when_module_script_is_missing():
    html_text = _render().replace('<script type="module">', '<script type="not-a-module">')

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_on_an_external_script_reference():
    html_text = _render().replace("<main", '<script src="./extra.js"></script><main')

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_on_an_external_stylesheet_reference():
    html_text = _render().replace(
        '<link rel="manifest" href="./manifest.webmanifest">',
        '<link rel="manifest" href="./manifest.webmanifest"><link rel="stylesheet" href="./style.css">',
    )

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_on_an_absolute_path():
    html_text = _render().replace(
        '<link rel="manifest" href="./manifest.webmanifest">',
        '<link rel="manifest" href="/manifest.webmanifest">',
    )

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_on_an_unresolved_import():
    html_text = _render(app_js_text='import { rankVenues } from "./ranking.js";\nconst x = 1;\n')
    # Force the import to survive by bypassing strip_app_import's own guard —
    # simulate a build_module_script defect directly on the HTML text instead,
    # since the real path already prevents this.
    html_text = html_text.replace(
        "export function rankVenues",
        'import { helper } from "./other.js";\nexport function rankVenues',
    )

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_on_fetch_in_the_module():
    html_text = _render().replace(
        "export function rankVenues",
        'fetch("./data.json");\nexport function rankVenues',
    )

    with pytest.raises(GenerationError):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_fails_when_a_venue_lacks_return_transport_status():
    html_text = _render(merged_venues=[_venue("a", **_meta())])
    # The fixture venue has no return_transport_status by construction.

    with pytest.raises(GenerationError, match="return_transport_status"):
        validate_generated_artifact(html_text)


def test_validate_generated_artifact_passes_when_every_venue_has_return_transport_status():
    html_text = _render(merged_venues=[_venue("a", return_transport_status={"state": "ok"}, **_meta())])

    validate_generated_artifact(html_text)  # must not raise


# --- generate_index_html (I/O wrapper) ------------------------------------------


def _write(tmp_path, name, content):
    path = tmp_path / name
    path.write_text(content)
    return path


def test_generate_index_html_writes_a_valid_artifact(tmp_path):
    import json

    venues_path = _write(tmp_path, "venues.json", json.dumps([
        {"id": "a", "business_status": "OPERATIONAL", "return_transport_status": {"state": "ok"}},
    ]))
    meta_path = _write(tmp_path, "venues_meta.json", json.dumps({"a": _meta()}))
    holidays_path = _write(tmp_path, "holidays.json", json.dumps({}))
    template_path = _write(tmp_path, "template.html", (FIXTURES / "template.html").read_text())
    ranking_path = _write(tmp_path, "ranking.js", RANKING_STUB)
    app_path = _write(tmp_path, "app.js", APP_STUB)
    style_path = _write(tmp_path, "style.css", STYLE_STUB)
    output_path = tmp_path / "index.html"

    generate_index_html(
        venues_path=venues_path,
        venues_meta_path=meta_path,
        holidays_path=holidays_path,
        seatlog_path=tmp_path / "seatlog.csv",  # deliberately absent
        template_path=template_path,
        ranking_js_path=ranking_path,
        app_js_path=app_path,
        style_css_path=style_path,
        output_path=output_path,
    )

    html_text = output_path.read_text()
    assert "export function rankVenues" in html_text
    validate_generated_artifact(html_text)


def test_generate_index_html_fails_loudly_on_id_mismatch_and_writes_nothing(tmp_path):
    import json

    venues_path = _write(tmp_path, "venues.json", json.dumps([
        {"id": "a", "business_status": "OPERATIONAL", "return_transport_status": {"state": "ok"}},
        {"id": "orphan-generated", "business_status": "OPERATIONAL", "return_transport_status": {"state": "ok"}},
    ]))
    meta_path = _write(tmp_path, "venues_meta.json", json.dumps({"a": _meta()}))
    holidays_path = _write(tmp_path, "holidays.json", json.dumps({}))
    template_path = _write(tmp_path, "template.html", (FIXTURES / "template.html").read_text())
    ranking_path = _write(tmp_path, "ranking.js", RANKING_STUB)
    app_path = _write(tmp_path, "app.js", APP_STUB)
    style_path = _write(tmp_path, "style.css", STYLE_STUB)
    output_path = tmp_path / "index.html"

    with pytest.raises(GenerationError, match="orphan-generated"):
        generate_index_html(
            venues_path=venues_path,
            venues_meta_path=meta_path,
            holidays_path=holidays_path,
            seatlog_path=tmp_path / "seatlog.csv",
            template_path=template_path,
            ranking_js_path=ranking_path,
            app_js_path=app_path,
            style_css_path=style_path,
            output_path=output_path,
        )
    assert not output_path.exists()


def test_generate_index_html_fails_loudly_when_holidays_json_is_absent(tmp_path):
    import json

    venues_path = _write(tmp_path, "venues.json", json.dumps([
        {"id": "a", "business_status": "OPERATIONAL", "return_transport_status": {"state": "ok"}},
    ]))
    meta_path = _write(tmp_path, "venues_meta.json", json.dumps({"a": _meta()}))
    template_path = _write(tmp_path, "template.html", (FIXTURES / "template.html").read_text())
    ranking_path = _write(tmp_path, "ranking.js", RANKING_STUB)
    app_path = _write(tmp_path, "app.js", APP_STUB)
    style_path = _write(tmp_path, "style.css", STYLE_STUB)
    output_path = tmp_path / "index.html"

    with pytest.raises(GenerationError, match="holidays"):
        generate_index_html(
            venues_path=venues_path,
            venues_meta_path=meta_path,
            holidays_path=tmp_path / "holidays.json",  # deliberately absent
            seatlog_path=tmp_path / "seatlog.csv",
            template_path=template_path,
            ranking_js_path=ranking_path,
            app_js_path=app_path,
            style_css_path=style_path,
            output_path=output_path,
        )
    assert not output_path.exists()


def test_generate_index_html_against_the_real_project_files(tmp_path):
    """The integration case: the real `web/ranking.js` and `web/app.js` (once
    written), with a tiny synthetic dataset — proving the actual module-
    inlining and collision contracts hold for the real source, not just the
    stub fixtures above. `data/venues.json` doesn't exist yet (step 7 isn't
    built), so the dataset here stays synthetic.
    """
    import json

    project_root = Path(__file__).parent.parent.parent
    venues_path = _write(tmp_path, "venues.json", json.dumps([
        {
            "id": "a",
            "business_status": "OPERATIONAL",
            "return_transport_status": {"state": "ok"},
            "access": {},
        },
    ]))
    meta_path = _write(tmp_path, "venues_meta.json", json.dumps({"a": _meta()}))
    holidays_path = _write(tmp_path, "holidays.json", json.dumps({}))
    template_path = _write(tmp_path, "template.html", (FIXTURES / "template.html").read_text())
    output_path = tmp_path / "index.html"

    generate_index_html(
        venues_path=venues_path,
        venues_meta_path=meta_path,
        holidays_path=holidays_path,
        seatlog_path=tmp_path / "seatlog.csv",
        template_path=template_path,
        ranking_js_path=project_root / "web" / "ranking.js",
        app_js_path=project_root / "web" / "app.js",
        style_css_path=project_root / "web" / "style.css",
        output_path=output_path,
    )

    validate_generated_artifact(output_path.read_text())
