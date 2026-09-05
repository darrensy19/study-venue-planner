.PHONY: refresh generate

# Coarsen + fetch + validate + merge + generate, in that order (PLAN.md,
# "Fetch layer and refresh orchestration"). Never commits — inspecting the
# diff, committing and pushing stay separate manual actions.
refresh:
	.venv/bin/python3 build/refresh.py

# Regenerate web/index.html from whatever data/venues.json already holds on
# disk. Zero network calls, zero API spend (PLAN.md, "Phase 1 review-response
# slice order", slice 0) — the recovery command, and what every later
# presentation slice verifies against instead of spending a live refresh.
generate:
	.venv/bin/python3 build/generate.py
