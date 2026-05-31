---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Location Intelligence
status: executing
last_updated: "2026-05-31T00:31:29.921Z"
last_activity: 2026-05-31
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** A single globe that shows everything happening in the world right now, extensible by anyone via plugins, and controllable by any AI agent via MCP.
**Current focus:** Phase 22 — geocoding-favorites

## Current Position

Phase: 22 (geocoding-favorites) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-05-31
Resume file: None

Progress: [███░░░░░░░] 25%

## Key Decisions (carried from v1.2)

- **MCP transport:** Stateless Streamable HTTP at /api/mcp; raw @modelcontextprotocol/sdk; Bearer auth via authenticateApiKey(). No custom server.ts.
- **Redis for ephemeral state:** Globe state, command queues, session catalogs all in Redis. PostgreSQL for user-owned persistent data.
- **SSE command bridge:** EventSource-based push (GET /api/globe/commands/stream). Reuse for fly_to in v1.3.
- **Plugin tools via frontend relay:** No engine endpoint. useMcpCatalogPublisher + useMcpRelayBridge pattern.
- **Three editions:** NEXT_PUBLIC_WWV_EDITION (local/cloud/demo). isDemo gate runs before auth on all new endpoints.
- **Generic API keys:** wwv_prefix.secret bearer tokens. authenticateApiKey() middleware reused for all new MCP tools.

## v1.3 Phase Map

| Phase | Goal | Key requirements |
|-------|------|-----------------|
| 22 | Geocoding + Favorites | GEO-01..03, FAV-01..03, SAFE-01..02 |
| 23 | Entity Filtering | FILT-01..04 |
| 24 | Route Wiring + Version Bump | INTG-01, INTG-02 |
| 25 | Documentation | DOC-01..04 |

## Blockers

None.

## Accumulated Context

- v1.2 archived at .planning/milestones/v1.2-* and tagged v1.2 in git.
- PR #215 (feat/mcp-support) open on GitHub, awaiting merge.
- Phase numbering continues from v1.2's last phase (21). v1.3 starts at Phase 22.
- Phase 23 (Entity Filtering) must ship atomically: GlobeCommand type extensions + catalog changes + all 4 FILT tools are coupled. Do not split.
- Phase 24 is purely mechanical wiring (no new logic); can proceed immediately after 22 and 23 complete.
- Nominatim integration: server-side rate limiter (1 req/sec Redis sliding window) + 24h result cache are mandatory before any geocoding tool goes live (GEO-03).
- Favorites use prisma.favorite directly -- never proxy through /api/user/favorites (cookie auth incompatible with API key sessions, SAFE-02).
