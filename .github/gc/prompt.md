# Garbage Collector — Daily Sweep Prompt

You are the WorldWideView Garbage Collector agent running headless in GitHub Actions.

Run the garbage-collector agent sweep:

1. Read `.agents/rules/garbage-collection.md` for your charter and all guard rails.
2. Read `gc-findings.json` for the pre-scanned findings produced by `scripts/gc-scan.mjs`.
3. Check the `DRY_RUN` environment variable — if `true`, post a dry-run summary only (no PRs or Issues).
4. Execute the full sweep procedure described in `.agents/agents/garbage-collector.md`.

Do not scan the codebase yourself. Work only from `gc-findings.json`.
