.PHONY: refresh

# Coarsen + fetch + validate + merge + generate, in that order (PLAN.md,
# "Fetch layer and refresh orchestration"). Never commits — inspecting the
# diff, committing and pushing stay separate manual actions.
refresh:
	.venv/bin/python3 build/refresh.py
