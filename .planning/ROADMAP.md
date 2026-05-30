# Roadmap: WorldWideView

## Milestones

- [x] **v1.2 Full MCP Support** - Phases 16-21 (shipped 2026-05-30) - [archive](milestones/v1.2-ROADMAP.md)

## Phases

<details>
<summary>v1.2 Full MCP Support (Phases 16-21) - SHIPPED 2026-05-30</summary>

- [x] Phase 16: API Key Auth Foundation (4/4 plans) - completed 2026-05-29
- [x] Phase 17: MCP Server Foundation (3/3 plans) - completed 2026-05-30
- [x] Phase 18: Globe State Sync + Sessions (4/4 plans + gap-closure) - completed 2026-05-30
- [x] Phase 19a: Globe Command Bridge poll-based (3/3 plans) - completed 2026-05-30
- [x] Phase 19b: SSE Push Transport (2/2 plans) - completed 2026-05-30
- [x] Phase 20: Data Query Tools (4/4 plans) - completed 2026-05-30
- [x] Phase 21: Plugin-Contributed Tools + Quality (5/5 plans) - completed 2026-05-30

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

## Backlog

Per the 21-REPLAN locked decision ("NO marketplace" in v1.2 scope), the two marketplace
plugin-management MCP tools were deferred. They require the marketplace JWT install bridge,
which was descoped to keep v1.2 worldwideview-only.

- **999.1 -- PLG-01: `list_plugins()` MCP tool** -- returns all marketplace plugins with
  install status for the authenticated user. Depends on marketplace API + JWT bridge.
- **999.2 -- PLG-02: `install_plugin({ pluginSlug })` MCP tool** -- triggers installation via
  the existing marketplace JWT bridge flow. Depends on PLG-01 + marketplace install endpoint.

- **999.3 -- UX-01: Show MCP / ConnectAgentHelper as "Cloud edition" upgrade CTA in demo** --
  Currently `!isDemo` in Header.tsx:449 hides the entire ConnectAgentHelper section in demo.
  UX improvement: surface it as a locked/teaser CTA that explains the feature and links to
  upgrade. Pairs with v1.3 MCP-OBSERVATIONS.md scope (geocoding, OSM search, basemap control,
  entity filtering, enhanced search, favorites, plugin-tool discovery).

Also tracked as partials (functional, refinement deferred):
- **CTRL-02** focus_entity entityId-only resolution -- currently a no-op without lat/lng;
  needs entity-id -> coordinate lookup wired into the command dispatch.
- **MCP-QA-03** explicit Redis reconnect test -- stateless SSE arch makes the original
  WebSocket-subscriber spec N/A; ioredis auto-reconnects. Add a reconnect test if reliability
  concerns arise.
