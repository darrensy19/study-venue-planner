"""scraper/busyness.py — fixture-based, no live network.

Fixtures under fixtures/serpapi_*.json are small trimmed real Phase 0
SerpApi responses, except the two files marked `_synthetic`, which are
hand-built and labelled so: no saved Phase 0 payload ever took the
local_results branch (every real query collapsed to place_results).
"""

import json
from pathlib import Path

from scraper.busyness import extract_histogram

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def test_extract_histogram_from_collapsed_place_results():
    result = extract_histogram(load_fixture("serpapi_search_collapsed_with_data"))
    assert set(result.keys()) == {"mon", "tue"}
    for buckets in result.values():
        assert buckets == sorted(buckets, key=lambda b: b["hour"])
        for bucket in buckets:
            assert set(bucket.keys()) == {"hour", "busyness"}


def test_extract_histogram_empty_when_no_popular_times():
    result = extract_histogram(load_fixture("serpapi_search_collapsed_empty"))
    assert result == {}


def test_extract_histogram_empty_when_no_place_results_at_all():
    result = extract_histogram(load_fixture("serpapi_no_match_synthetic"))
    assert result == {}


def test_extract_histogram_skips_unparseable_time_and_missing_score():
    payload = {
        "place_results": {
            "popular_times": {
                "graph_results": {
                    "monday": [
                        {"time": "6 AM", "busyness_score": 10},
                        {"time": "not a time", "busyness_score": 20},
                        {"time": "7 AM"},
                    ]
                }
            }
        }
    }
    result = extract_histogram(payload)
    assert result == {"mon": [{"hour": 6, "busyness": 10}]}


def test_extract_histogram_maps_noon_and_midnight_correctly():
    payload = {
        "place_results": {
            "popular_times": {
                "graph_results": {
                    "monday": [
                        {"time": "12 AM", "busyness_score": 0},
                        {"time": "12 PM", "busyness_score": 50},
                    ]
                }
            }
        }
    }
    result = extract_histogram(payload)
    assert result == {
        "mon": [{"hour": 0, "busyness": 0}, {"hour": 12, "busyness": 50}]
    }
