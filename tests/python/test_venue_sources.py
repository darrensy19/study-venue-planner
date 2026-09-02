"""scraper/venue_sources.py — registry preconditions, checked before any
API call (PLAN.md, "The venue-source registry")."""

import pytest

from scraper.venue_sources import RegistryValidationError, validate_registry

GOOD_RECORD = {
    "venue_id": "starbucks-centrepoint",
    "place_id": "ChIJRZ1c0JYZ2jERZi1GJIoRVy0",
    "resolved_name": "Starbucks Centrepoint",
    "resolved_address": "176 Orchard Rd, Singapore 238843",
}


def other_record(venue_id="starbucks-wisma-atria", place_id="ChIJkQL5B5IZ2jER520GahisXVQ"):
    return {
        "venue_id": venue_id,
        "place_id": place_id,
        "resolved_name": "Starbucks Wisma Atria",
        "resolved_address": "435 Orchard Rd, Singapore 238877",
    }


def test_valid_registry_passes():
    records = [GOOD_RECORD, other_record()]
    meta_ids = {"starbucks-centrepoint", "starbucks-wisma-atria"}
    validate_registry(records, meta_ids)  # no raise


@pytest.mark.parametrize("field", ["venue_id", "place_id", "resolved_name", "resolved_address"])
def test_missing_field_fails(field):
    record = dict(GOOD_RECORD)
    del record[field]
    with pytest.raises(RegistryValidationError, match=field):
        validate_registry([record], {"starbucks-centrepoint"})


@pytest.mark.parametrize("field", ["venue_id", "place_id", "resolved_name", "resolved_address"])
def test_empty_field_fails(field):
    record = dict(GOOD_RECORD)
    record[field] = ""
    with pytest.raises(RegistryValidationError, match=field):
        validate_registry([record], {"starbucks-centrepoint"})


def test_duplicate_venue_id_fails():
    dup = dict(other_record())
    dup["venue_id"] = GOOD_RECORD["venue_id"]
    with pytest.raises(RegistryValidationError, match="duplicate venue_id"):
        validate_registry([GOOD_RECORD, dup], {"starbucks-centrepoint"})


def test_duplicate_place_id_fails():
    dup = dict(other_record())
    dup["place_id"] = GOOD_RECORD["place_id"]
    with pytest.raises(RegistryValidationError, match="duplicate place_id"):
        validate_registry(
            [GOOD_RECORD, dup], {"starbucks-centrepoint", "starbucks-wisma-atria"}
        )


def test_extra_registry_venue_not_in_meta_fails():
    records = [GOOD_RECORD, other_record()]
    with pytest.raises(RegistryValidationError, match="disagrees"):
        validate_registry(records, {"starbucks-centrepoint"})


def test_extra_meta_venue_not_in_registry_fails():
    with pytest.raises(RegistryValidationError, match="disagrees"):
        validate_registry(
            [GOOD_RECORD], {"starbucks-centrepoint", "some-venue-not-in-registry"}
        )
