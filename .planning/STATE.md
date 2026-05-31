---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Full MCP Support
status: active
last_updated: "2026-05-30T09:54:58.389Z"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 23
  completed_plans: 16
  percent: 43
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

**Phase 16:** code complete (5f3fe69 UI, 90dfb68 tsc fix). UAT run on :3005 (Playwright) passed steps
1-5 EXCEPT: (a) cosmetic - existing section header reads "Your API Keys" not spec's "Service Keys"
(fix in progress); (b) ANOMALY - after reload, GET /api/api-keys returned [] (all keys vanished). A
debugger agent is investigating whether (b) is a code bug or a shared-dev-DB-across-worktrees artifact,
and fixing (a). Phase 16 NOT marked verified until (b) is resolved.

**Phase 17:** COMPLETE (verified 2026-05-30). Wave 0 (fcb7a5e) + Wave 1 (e0ad832, 0053f1d) + Wave 2
(6f77495). Human-verify PASSED 6/6: token only in Authorization header, copy buttons flip, placeholder
after dismiss, 401 JSON-RPC body, 200 SSE with x-accel-buffering:no + protocolVersion 2025-06-18.
Version 2.26.0.

**Phase 18:** COMPLETE (2026-05-30). Wave 0 + 1 + 2 + 3 all done. 498/498 tests GREEN. Delivered:
ioredis singleton, GlobeStateSnapshot, globeStateStore (ZSET sessions), POST /api/globe/state (dual
auth per R-2), useSessionId + useGlobeStateSync hooks, GlobeView wiring, registerGlobeResources MCP
module (RSRC-02/03/04), route.ts first R-1 edit. Version TBD (bump in final commit).

**Phase 20:** COMPLETE (2026-05-30). All waves done. 498/498 tests GREEN. Delivered: types.ts +
service.ts transport-neutral service layer, REST routes (search + region), registerDataQueryTools
MCP module (TOOL-01/02/03/04), route.ts second R-1 edit. Commit a5b4b62 (combined with Phase 18).
Version 2.27.0.

**Phase 19:** SPLIT (2026-05-30, user-approved) into 19a + 19b. See phases/19-globe-command-bridge/19-SPLIT.md.

- **19a (Globe Command System Tools, poll-based):** COMPLETE (2026-05-30, commit a3c8f12). Command tools
  (pan/focus/toggle/timeline) + Redis list queue + GET /api/globe/commands poll route + browser poll hook.
  NO boot-path change. Covers CTRL-04 + CTRL-05. Version 2.28.0.

  - All 3 waves GREEN. Full suite 573 passed / 0 failed.
  - code-reviewer + security-reviewer DONE: no Critical/High. Security PASS on hard invariants (userId only
    from auth, gate ordering rate-limit -> isDemo 403 -> auth, per-user/tenant queue namespacing, no secret in
    URL, double-validation). Review findings folded in: timeWindow/currentTime validation, atomic enqueue
    (multi.rpush.expire), UUID sessionId 400 guard, dedicated globeCommandsLimiter (120/60s), in-flight poll
    guard, focusEntity entityId-only -> console.warn (no 0,0 fly), z.enum timeWindow.

  - Committed: 15 files (excluded pnpm-lock.yaml, .planning, debug PNGs per constraints).
- **Phase 21 readiness (IMPORTANT — two conflicting plan generations on disk):**
    - AUTHORITATIVE: 21-REPLAN.md + 21-DECISIONS.md (May 30 02:16) — PLUG-03 via streamUrl delegation,
      worldwideview-only, NO engine endpoint, NO marketplace. 4 decisions LOCKED.

    - STALE: 21-RESEARCH.md + 21-01..04-PLAN.md (May 29 22:31-23:28) — route PLUG-03 through a NEW
      wwv-data-engine REST endpoint + marketplace JWT bridge. DO NOT EXECUTE these wave plans; they predate
      the re-plan. Archive them and regenerate 21-01..N against 21-REPLAN.md before executing.

    - OPEN DECISION (the one heavy item): InstalledPlugin model is keyed by tenantId (nullable), NOT userId.
      The MCP auth chain produces userId. Wave 2 ("tools/list from user's active installed plugins") needs a
      resolved userId -> tenantId -> InstalledPlugin path. Stale research's `findMany({ where: { userId } })`
      will NOT compile. Decide enumeration strategy (likely tenantId null in local edition = single-tenant)
      before planning Wave 2.

- **19b (WebSocket push transport):** DEFERRED out of milestone. server.ts + WS + Docker entrypoint + Nginx
  + pub/sub subscriber. Covers CTRL-01/02/03/06. Basis = original 19-01..19-05 plans. Not executed unless
  user later requests. The risky boot-path change is parked here.

**Phase 21:** COMPLETE (2026-05-30). All 5 waves done. PR #215 open on feat/mcp-support. Re-planned as v3 frontend-relay (21-REPLAN.md). Delivered: McpToolDeclaration SDK type, mcpTools/mcpCapabilities manifest fields, executeMcpTool hook, per-session Redis catalog, catalog POST route, useMcpCatalogPublisher, composePluginToolsList, mcpRelay (enqueue/wait/post/drain), /api/mcp/invocations GET, /api/mcp/results POST, useMcpRelayBridge, namespaced-tool dispatch in route.ts, README MCP config block. Version 2.29.x committed.

**Phase 19b:** COMPLETE (2026-05-30, commit 7fd1d7e, version 2.30.0). SSE push transport replacing the 1500ms poll loop. Delivered: GET /api/globe/commands/stream (ReadableStream, 200ms drain, 15s keepalive, 16s max, dual-auth, isDemo 403, globeCommandsStreamLimiter 10/60s, cancel() disconnect cleanup), useGlobeCommandBridge rewritten to EventSource with envelope validation and onerror handler. Poll route kept. 654/654 tests GREEN. tsc + lint clean.

- **21-03 (Wave 2, catalog + tools/list):** COMPLETE (2026-05-30, commits 6779921 + cbd48e5 + 23b893c). publishSessionCatalog/readSessionCatalog (Redis SET+EX, {userId}:{sessionId} key, 120s TTL), POST /api/mcp/catalog (dual-auth, UUID guard, size cap, isDemo gate), useMcpCatalogPublisher hook (reads pluginManager manifests, POSTs on mount + 30s interval), composePluginToolsList (system tools + de-duplicated namespaced plugin tools + capability copy), registerPluginTools in route.ts (reads per-session catalog, registers stub handlers). CAT-01..06 + LIST-01..05 GREEN. Zod v4 z.record() fix applied.

- **21-02 (Wave 1, SDK):** COMPLETE (2026-05-30, commit bda235f). McpToolDeclaration (NO execution field), mcpTools? + mcpCapabilities? in PluginManifest, WorldPlugin.executeMcpTool? hook, validateManifest extended with MAN-01..08 rules, getNamespacedTools + validateToolArgs in src/lib/mcp/pluginTools.ts. 32/32 targeted tests GREEN. Pre-existing Wave 0 RED tests for future waves remain red (correct).

- **21-01 (Wave 0, RED):** COMPLETE (2026-05-30, commit 5930bc7). Six RED test files authored:
  validateManifest.test.ts (extended + MAN-01..08), pluginTools.test.ts (PT-01..08),
  mcpSessionCatalog.test.ts (CAT-01..06), pluginToolsList.test.ts (LIST-01..05),
  mcpRelay.test.ts (RELAY-01 + SEC-01..05), pluginToolDispatch.test.ts (MCP-QA-01..04 + SEC-01/06).
  tsc: only TS2307 "module not found" (expected). lint: zero errors on new files. vitest: 5 files FAIL
  "Failed to resolve import" (correct RED), validateManifest.test.ts 7 RED + 9 GREEN.

**Execution order (per RECONCILIATION R-7):** 17 done -> 18 done -> 20 done -> 19 (PAUSED, awaiting
user discussion on WebSocket + custom server.ts) -> 21 (re-plan pause). route.ts serialization:
18-04 first, then 20-04 appended. Commit checkpoint: a5b4b62 (Phases 18 + 20 combined).

## Phase 17 Plan Map (planned 2026-05-29)

- **17-01 (Wave 0, autonomous):** RED test scaffolds for /api/mcp (401 JSON-RPC, 403 demo gate,
  stateless per-request construction, X-Accel-Buffering header) + a raw-SDK transport runtime spike
  that proves WebStandardStreamableHTTPServerTransport + McpServer instantiate/connect outside a
  custom server (or flags a blocker). Covers MCP-01..04.

- **17-02 (Wave 1, autonomous + blocking-human SDK-legitimacy checkpoint):** `pnpm add
  @modelcontextprotocol/sdk@^1.29.0`, `src/lib/mcp/server.ts` createMcpServer() factory (empty
  capabilities), and the gated stateless `src/app/api/mcp/route.ts` (isDemo-first 403, Bearer 401
  via Phase 16 authenticateApiKey, fresh server+transport per request, X-Accel-Buffering: no). Turns
  Wave 0 green. Covers MCP-01..04.

- **17-03 (Wave 2, autonomous + human-verify checkpoint):** `ConnectAgentHelper.tsx` (per-edition
  URL + mcpServers JSON with Bearer header for Desktop/Cursor/VS Code + Manual block + agent prompt;
  Claude Code CLI deferred as "coming soon"), mounted where the Phase 16 TODO placeholder was;
  `.agents/context/server-management.md` Coolify/Nginx streaming runbook (documented, not automated);
  semver bump 2.25.0 -> 2.26.0. Covers CONNECT-01/02/03.

## Key Decisions

- **17 transport decision (LOCKED, BATCH-DECISIONS-17-21.md + 17-CONTEXT.md):** raw
  `@modelcontextprotocol/sdk@^1.29.0` (NOT mcp-handler) + the SDK's
  `WebStandardStreamableHTTPServerTransport` (`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`)
  inside a Next 16 App Router route handler at `src/app/api/mcp/route.ts`. **Confirmed against the
  published SDK 1.29.0 types**: `handleRequest(req: Request): Promise<Response>` is Web-Standard and
  documented for Hono/Cloudflare-Workers fetch handlers — identical Request/Response shape to a Next 16
  route handler. NO custom `server.ts` is needed in Phase 17 (that is a Phase 19 / WebSocket artifact).
  NO BLOCKER. A Wave 0 spike re-confirms at runtime and escalates only if the transport genuinely
  cannot run in a route handler.

- **17 stateless (D-17-04):** fresh McpServer + transport per request (sessionIdGenerator: undefined),
  never cached at module scope, with a guard-rail comment. No tools/resources registered this phase.

- **17 auth (D-17-03):** reuse Phase 16 `authenticateApiKey()` unchanged; 401 JSON-RPC body
  `{ jsonrpc:"2.0", error:{ code:-32600, message:"Unauthorized" }, id:null }`. Demo -> 403, gate FIRST.

- **17 connect helper (D-17-08/09):** in "API & MCP Access"; mcpServers JSON carries the token in the
  Authorization HEADER (raw-SDK Streamable HTTP form), never in a URL; Claude Code CLI deferred "coming
  soon". Nginx/Coolify buffering documented (D-17-07), not automated.

- **17-03 (Wave 2):** mcpServers JSON shape uses `{ "url": "...", "headers": { "Authorization": "Bearer
  <token>" } }` -- raw-SDK Streamable HTTP form (D-17-09). Local URL derived from window.location.origin
  at runtime (not hardcoded :3000). CopyField sub-component pattern established for clipboard interactions.
  .agents/context/ is gitignored in both worktree and main repo; server-management.md exists on disk as
  a local operator runbook only (D-17-07 intent: document not automate).

- **17-02 (Wave 1):** vitest.config.ts clearMocks: true required to fix mock call count isolation
  between describe blocks (MCP-04 demo-gate tests inherited stale call counts from MCP-03 without this).
  Optional chaining on server?.connect?.() and transport.handleRequest?.() guards against vi.resetAllMocks()
  clearing SDK mock implementations in happy-path tests. AuthInfo.token = "" (raw token not re-exposed).
  createMcpServer() capabilities: { tools: { listChanged: true } } per RECONCILIATION R-1.

- **17-01 (Wave 0):** @vite-ignore on variable-based import specifier required in transport spike to
  prevent Vite's import-analysis from crashing at transform time on absent SDK. Runtime try/catch alone
  is insufficient because Vite resolves import() specifiers statically before test execution.
  SDK vi.mock factories (no real module) work correctly for route.test.ts stateless-construction tests.

- **16-01 (Wave 0):** Three RED test files lock api-key contracts (token format, timing oracle T-16-01,
  max-3, ownership-scoped delete) before any implementation. timing-oracle test tagged `// [slow]`.

- **16-02 (Wave 1):** UserApiKey Prisma model + apiKeyAuth.ts helper. DUMMY_HASH pre-baked literal
  eliminates cold-start timing oracle gap; async bcrypt compare always runs on miss (T-16-01). All
  helper tests GREEN.

- **16-03 (Wave 2):** isDemo gate runs FIRST (before auth()). deleteMany ownership-scoped delete
  eliminates TOCTOU (T-16-06). fullToken returned once in POST 201; GET omits hashedSecret (T-16-07).

- **16-04 (Wave 3):** PersonalApiKeysSection UI shipped in the renamed "Keys & Access" modal; version
  bumped to 2.25.0; Phase 17 connect-helper placeholder comment left at ~L347.

- v1.2 QA requirement IDs renamed `QA-01/02/03` -> `MCP-QA-01/02/03` to resolve a v1.1 collision.
- One primary worktree for the whole milestone; data-engine / SDK / marketplace are declared cross-repo
  dependencies, not separate planning roots.

- **Scope expansion (2026-05-29, user-approved):** keys are generic transport-agnostic API keys (req
  API-01); one reusable `authenticateApiKey()` middleware; capabilities as a shared service layer
  wrapped by MCP + future REST (`/api/v1/*`, Phases 20/21). CLI deferred to a future milestone.

## Milestone Audit (2026-05-30)

v1.2 audited: status **tech_debt** (no critical blockers). Report: `.planning/v1.2-MILESTONE-AUDIT.md`.
Requirements: 31 Complete, 2 Partial (CTRL-02 entityId-only focus, MCP-QA-03 reconnect test),
2 Deferred (PLG-01/PLG-02 -- marketplace descoped to v1.3 per 21-REPLAN). Integration: 47/52,
all 4 browser hooks mounted, 9/12 E2E flows complete (2 broken = the deferred PLG tools).

**Tech debt closed (commit dc1e802, version 2.30.1, pushed):** mcpRelay enqueue+postResult made
atomic (multi/exec) + redis.ts RedisMultiChain.set(); v1 entity routes got dual-auth + isDemo 403
gate + NaN limit guard + global-read intent comment; useGlobeStateSync immediate initial push
(ran-once ref) closes the session-registration race; useMcpCatalogPublisher wired to
getNamespacedTools (DRY); deleted dead pluginToolsList.ts. Code + security review: no Critical/High;
all review warnings folded in. 643/643 tests, tsc clean, lint clean.

REQUIREMENTS.md traceability table + checkboxes updated to actual status. ROADMAP.md has a
"Deferred to v1.3 (Backlog)" section for PLG-01/02 (999.1/999.2).

**Gap-closure 18-05 (2026-05-30, commit ee16ec0):** POST /api/globe/state isDemo gate added.
Returns 403 { error: "Not available in demo edition" } before auth when isDemo is true. Closes
GAP-01 from PR #215 pre-merge audit. vi.hoisted() pattern used for mutable editionMock (deviation
from plan's simpler const suggestion -- Vitest hoisting requires it). 6/6 tests green, tsc clean.
useGlobeStateSync confirmed to handle 403 silently with no code change (fetch catches only thrown
exceptions, not HTTP responses). RSRC-01 fully satisfied.

## Remaining for milestone close

1. Merge PR #215 (feat/mcp-support -> main) once CI is green.
2. After merge: run milestone lifecycle (`/gsd:autonomous` no --only, or
   `/gsd:complete-milestone v1.2` then `/gsd:cleanup`) to archive + tag + clean up the worktree.

## Blockers

None. (Phase 17 transport-in-route-handler question resolved: confirmed viable, no custom server.ts.)
