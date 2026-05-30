---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Location Intelligence
status: planning
last_updated: "2026-05-31T10:57:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** A single globe that shows everything happening in the world right now, extensible by anyone via plugins, and controllable by any AI agent via MCP.
**Current focus:** v1.3 Location Intelligence — defining requirements and roadmap.

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-05-31 -- Milestone v1.3 started

## Key Decisions (carried from v1.2)

- **MCP transport:** Stateless Streamable HTTP at /api/mcp; raw @modelcontextprotocol/sdk; Bearer auth via authenticateApiKey(). No custom server.ts.
- **Redis for ephemeral state:** Globe state, command queues, session catalogs all in Redis. PostgreSQL for user-owned persistent data.
- **SSE command bridge:** EventSource-based push (GET /api/globe/commands/stream). Reuse for fly_to in v1.3.
- **Plugin tools via frontend relay:** No engine endpoint. useMcpCatalogPublisher + useMcpRelayBridge pattern.
- **Three editions:** NEXT_PUBLIC_WWV_EDITION (local/cloud/demo). isDemo gate runs before auth on all new endpoints.
- **Generic API keys:** wwv_prefix.secret bearer tokens. authenticateApiKey() middleware reused for all new MCP tools.

## Blockers

None.

## Accumulated Context

- v1.2 archived at .planning/milestones/v1.2-* and tagged v1.2 in git.
- PR #215 (feat/mcp-support) open on GitHub, awaiting merge.
- Phase numbering continues from v1.2's last phase (21). v1.3 starts at Phase 22.
