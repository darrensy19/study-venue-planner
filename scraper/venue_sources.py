"""The venue-source registry contract — `data/venue_sources.json`.

The canonical Phase 1 fetch registry (`PLAN.md`, "The venue-source
registry"). Preconditions here are checked before any API call, and again
during generation, against the whole of `venues_meta.json`.
"""

import json

REQUIRED_FIELDS = ("venue_id", "place_id", "resolved_name", "resolved_address")


class RegistryValidationError(ValueError):
    """The registry (or a candidate for it) violates the fetch-registry contract."""


def load_registry(path):
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    return data.get("venues", [])


def validate_registry(records, meta_venue_ids):
    """All four fields present, both ID sets unique, and exact agreement
    with `venues_meta.json`'s key set. Raises on the first violation found;
    checked before any API call.
    """
    for index, record in enumerate(records):
        for field in REQUIRED_FIELDS:
            value = record.get(field)
            if not isinstance(value, str) or not value.strip():
                raise RegistryValidationError(
                    f"record {index} ({record.get('venue_id', '?')}): "
                    f"{field!r} must be a nonempty string"
                )

    venue_ids = [record["venue_id"] for record in records]
    if len(venue_ids) != len(set(venue_ids)):
        dupes = sorted({v for v in venue_ids if venue_ids.count(v) > 1})
        raise RegistryValidationError(f"duplicate venue_id(s): {dupes}")

    place_ids = [record["place_id"] for record in records]
    if len(place_ids) != len(set(place_ids)):
        dupes = sorted({p for p in place_ids if place_ids.count(p) > 1})
        raise RegistryValidationError(f"duplicate place_id(s): {dupes}")

    registry_ids = set(venue_ids)
    meta_ids = set(meta_venue_ids)
    if registry_ids != meta_ids:
        only_registry = sorted(registry_ids - meta_ids)
        only_meta = sorted(meta_ids - registry_ids)
        raise RegistryValidationError(
            "registry venue_id set disagrees with venues_meta.json: "
            f"only in registry={only_registry}, only in meta={only_meta}"
        )
