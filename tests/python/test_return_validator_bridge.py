"""build/return_validator_bridge.py — the Python side of the return-validator
bridge. Runs the real Node script (`build/validate_return_transport.mjs`)
against `tmp_path` fixtures; no live network involved. Stub `.mjs` scripts
simulate each broken-bridge condition without touching the real bridge or
`validateReturnTransport()` itself, which stays fixture-tested in
`tests/js/ranking.test.js`.
"""

import json

import pytest

from build.return_validator_bridge import BridgeError, validate_return_transport

REAL_META_PATH = "data/venues_meta.json"


def write_meta(tmp_path, venues, name="venues_meta.json"):
    path = tmp_path / name
    path.write_text(json.dumps(venues), encoding="utf-8")
    return path


def test_round_trip_against_live_meta_stamps_every_venue():
    with open(REAL_META_PATH, encoding="utf-8") as f:
        expected_ids = set(json.load(f).keys())

    status = validate_return_transport(REAL_META_PATH)

    assert set(status.keys()) == expected_ids
    # `return_transport` is still unfilled for every venue (0/28) — every
    # MISSING shape stamps "ok" per `validateReturnTransport`'s own contract.
    assert all(entry == {"state": "ok"} for entry in status.values())


def test_per_venue_invalid_is_a_result_not_an_exception(tmp_path):
    meta = {
        "fine": {},
        "broken": {
            "return_transport": {
                "home": {"transit": {"default": {"last_departure_band": "23:5-00:00"}}}
            }
        },
    }
    meta_path = write_meta(tmp_path, meta)

    status = validate_return_transport(meta_path)

    assert status["fine"] == {"state": "ok"}
    assert status["broken"]["state"] == "invalid"


def test_meta_path_with_spaces_and_shell_metacharacters_is_handled_safely(tmp_path):
    odd_dir = tmp_path / "odd dir; echo pwned && $(whoami)"
    odd_dir.mkdir()
    meta_path = write_meta(odd_dir, {"v1": {}})

    status = validate_return_transport(meta_path)

    assert status == {"v1": {"state": "ok"}}


def test_never_writes_any_file(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}})
    before = sorted(p.name for p in tmp_path.iterdir())

    validate_return_transport(meta_path)

    after = sorted(p.name for p in tmp_path.iterdir())
    assert after == before


def test_node_missing_raises_bridge_error(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}})

    with pytest.raises(BridgeError, match="node executable not found"):
        validate_return_transport(meta_path, node_path="definitely-not-a-real-node-binary")


def test_nonzero_exit_raises_bridge_error(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}})
    stub = tmp_path / "stub_nonzero.mjs"
    stub.write_text('process.stderr.write("boom"); process.exit(1);\n', encoding="utf-8")

    with pytest.raises(BridgeError, match="bridge exited 1"):
        validate_return_transport(meta_path, script_path=stub)


def test_non_json_stdout_raises_bridge_error(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}})
    stub = tmp_path / "stub_garbage.mjs"
    stub.write_text('process.stdout.write("not json");\n', encoding="utf-8")

    with pytest.raises(BridgeError, match="not valid JSON"):
        validate_return_transport(meta_path, script_path=stub)


def test_stdout_not_a_json_object_raises_bridge_error(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}})
    stub = tmp_path / "stub_array.mjs"
    stub.write_text('process.stdout.write("[1, 2, 3]");\n', encoding="utf-8")

    with pytest.raises(BridgeError, match="not a JSON object"):
        validate_return_transport(meta_path, script_path=stub)


def test_missing_status_for_a_venue_raises_bridge_error(tmp_path):
    meta_path = write_meta(tmp_path, {"v1": {}, "v2": {}})
    stub = tmp_path / "stub_partial.mjs"
    stub.write_text('process.stdout.write(JSON.stringify({v1: {state: "ok"}}));\n', encoding="utf-8")

    with pytest.raises(BridgeError, match="missing status for.*v2"):
        validate_return_transport(meta_path, script_path=stub)


@pytest.mark.parametrize(
    "malformed_value",
    [
        "null",
        "{}",
        '{"state": "what"}',
        '{"state": "invalid"}',
        '{"state": "invalid", "reason": 42}',
        '"ok"',
        "[]",
    ],
)
def test_malformed_per_venue_status_raises_bridge_error(tmp_path, malformed_value):
    meta_path = write_meta(tmp_path, {"v1": {}})
    stub = tmp_path / "stub_malformed_value.mjs"
    stub.write_text(
        f'process.stdout.write(JSON.stringify({{v1: {malformed_value}}}));\n', encoding="utf-8"
    )

    with pytest.raises(BridgeError, match="malformed per-venue status for.*v1"):
        validate_return_transport(meta_path, script_path=stub)
