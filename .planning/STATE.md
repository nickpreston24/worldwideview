---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: full-mcp-support
status: active
last_updated: "2026-05-29T09:53:41.026Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

Isolated planning workspace for the **v1.2 Full MCP Support** milestone (Phases 16-21).
Split out of the shared root `C:\dev\wwv\.planning` on 2026-05-29 because v1.1 (marketplace
auth gate) and v1.2 (MCP server) were tangled in one ROADMAP/REQUIREMENTS with no shared
phases or dependency.

Primary repo: this worktree (`worldwideview`, branch `feat/mcp-support`).
Cross-repo deps declared in ROADMAP.md: Phase 20 -> wwv-data-engine REST; Phase 21 ->
wwv-data-engine + `@worldwideview/wwv-plugin-sdk` + marketplace JWT bridge.

Cross-feature docs (MILESTONES.md, the plugin-pipeline backlogs) stay at the shared root and
are NOT duplicated here.

## Current Position

Phase: 16 (API Key Auth Foundation) — EXECUTING
Plan: 4 of 4
Phase 16 (API Key Auth Foundation) -- **plan 03 complete** (Wave 2 CRUD route handlers committed 2026-05-29).
Wave 2: GET/POST /api/api-keys + DELETE /api/api-keys/[id] implemented. isDemo gate + ownership-scoped deleteMany. 403/403 tests green (56 test files).
Next: Plan 04 (Wave 3) -- PersonalApiKeysSection UI component.

## Key Decisions

- **16-01 (Wave 0):** Three RED test files lock api-key contracts (token format, timing oracle T-16-01, max-3, ownership-scoped delete) before any implementation. timing-oracle test tagged `// [slow]` asserts miss-path elapsed > 100ms.

- **16-02 (Wave 1):** UserApiKey Prisma model + apiKeyAuth.ts helper. DUMMY_HASH pre-baked literal ($2b$12$...) eliminates cold-start timing oracle gap. async bcrypt compare always runs on miss path (T-16-01 mitigated). Module-level Map throttle for lastUsedAt (1 write/min/key). All 11 helper tests GREEN.

- v1.2 QA requirement IDs renamed `QA-01/02/03` -> `MCP-QA-01/02/03` to resolve a collision
  with v1.1's own `QA-01/02/03`.

- One primary worktree for the whole milestone; data-engine / SDK / marketplace are declared
  cross-repo dependencies, not separate planning roots.

- **Scope expansion (2026-05-29, user-approved):** keys are **generic transport-agnostic API
  keys** (not MCP-only) -> new req API-01; one reusable `authenticateApiKey()` middleware;
  capabilities built as a shared service layer wrapped thinly by MCP + future REST (`/api/v1/*`,
  incremental w/ Phases 20/21). CLI deferred to a future milestone.

- **"Connect your agent" helper** (reveal-once key + per-client config tabs + paste-prompt) ->
  new reqs CONNECT-01/02/03, placed in **Phase 17** (needs the live `/api/mcp` URL to point at).

- Phase 16 grey areas resolved: combined `wwv_<prefix>.<secret>` token (32-byte base64url secret,
  bcrypt cost 12); `UserApiKey`/`user_api_keys` model; hard-delete revoke; throttled fire-and-forget
  `lastUsedAt`; max-3 enforced in route + UI; UI in renamed "Keys & Access" modal; local+cloud only.

- **16-03 (Wave 2):** isDemo gate runs FIRST (before auth()) on all three handlers (Pitfall 6). deleteMany ownership-scoped delete eliminates TOCTOU (T-16-06 BOLA prevention). fullToken returned exactly once in POST 201 body; GET select projection omits hashedSecret (T-16-07). P2002 prefix-collision handled with single retry in createKeyWithRetry helper.

## Blockers

None.
