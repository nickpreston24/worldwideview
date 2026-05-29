/**
 * GET / POST / DELETE /api/mcp
 *
 * Stateless Streamable HTTP MCP endpoint (Phase 17).
 *
 * Gate ordering (D-17-05, MCP-04):
 *   1. Edition check — isDemo → 403 JSON-RPC error (runs BEFORE auth)
 *   2. Bearer auth   — authenticateApiKey() → 401 JSON-RPC error on failure
 *   3. Fresh McpServer + transport per request (D-17-04, MCP-05)
 *   4. Delegate to transport.handleRequest() → streaming Response
 *
 * STATELESS INVARIANT (D-17-04): McpServer and WebStandardStreamableHTTPServerTransport
 * are constructed INSIDE the handler on every request and NEVER cached at module
 * scope. Do NOT hoist server/transport creation outside of handleMcpRequest().
 * A module-level singleton would bind the transport to a prior request context,
 * causing all subsequent requests to fail silently (Pitfall 2).
 *
 * Future capability registration seam (RECONCILIATION R-1):
 *   After createMcpServer() + server.connect(transport) and BEFORE
 *   transport.handleRequest(), later phases append ONE registrar call each:
 *     Phase 18: registerGlobeResources(server, { userId })
 *     Phase 19: registerGlobeCommandTools(server, { userId })
 *     Phase 20: registerDataQueryTools(server, { userId })
 *     Phase 21: dynamic per-plugin tools
 *   userId is available from the auth result at that point.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { isDemo } from "@/core/edition";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import { createMcpServer } from "@/lib/mcp/server";
import { mcpLimiter, getClientIp } from "@/lib/rateLimiters";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 error response helpers
// ---------------------------------------------------------------------------

/**
 * Returns 403 + JSON-RPC 2.0 body for the demo edition gate (MCP-04).
 * Runs BEFORE auth so the demo-admin FK write path is never reached.
 */
function demoBlockedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "MCP is not available in demo mode" },
            id: null,
        },
        { status: 403 },
    );
}

/**
 * Returns 401 + JSON-RPC 2.0 body for missing / invalid Bearer token (MCP-03).
 * Content-Type is application/json (not plain text — Pitfall 3).
 */
function unauthorizedResponse(): Response {
    return Response.json(
        {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Unauthorized" },
            id: null,
        },
        { status: 401 },
    );
}

// ---------------------------------------------------------------------------
// Header merge helper
// ---------------------------------------------------------------------------

/**
 * Ensures X-Accel-Buffering: no (and Cache-Control: no-cache, no-transform)
 * are present on the response without clobbering the SDK's Content-Type or
 * buffering the response body into memory (Pitfall 1 / D-17-06 / MCP-06).
 *
 * We clone the response headers, add the missing headers, then return a new
 * Response that streams the original body.
 */
function withStreamingHeaders(sdkResponse: Response): Response {
    const headers = new Headers(sdkResponse.headers);
    headers.set("X-Accel-Buffering", "no");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");
    return new Response(sdkResponse.body, {
        status: sdkResponse.status,
        statusText: sdkResponse.statusText,
        headers,
    });
}

// ---------------------------------------------------------------------------
// Core handler — all three methods delegate here
// ---------------------------------------------------------------------------

async function handleMcpRequest(request: Request): Promise<Response> {
    // ------------------------------------------------------------------
    // Gate 0: Rate limit (H1) — runs BEFORE edition check and auth so
    // scanners never reach the DB layer.
    // ------------------------------------------------------------------
    const ipLimitResult = mcpLimiter.check(getClientIp(request));
    if (ipLimitResult) return ipLimitResult;

    // ------------------------------------------------------------------
    // Gate 1: Edition check (D-17-05, MCP-04)
    // Must run BEFORE authenticateApiKey so demo edition never reaches
    // the auth/DB layer (avoids demo-admin FK write — Pitfall 5).
    // ------------------------------------------------------------------
    if (isDemo) {
        return demoBlockedResponse();
    }

    // ------------------------------------------------------------------
    // Gate 2: Bearer auth (D-17-03, MCP-03)
    // authenticateApiKey() reads Authorization header; never throws.
    // ------------------------------------------------------------------
    const authResult = await authenticateApiKey(request);
    if (!authResult) {
        console.warn("[mcp] unauthorized request");
        return unauthorizedResponse();
    }

    // ------------------------------------------------------------------
    // Build a FRESH server + transport per request (D-17-04, MCP-05).
    // STATELESS INVARIANT: never hoist these to module scope.
    // Do NOT cache server or transport between requests.
    // ------------------------------------------------------------------
    const server = createMcpServer();

    // Phase 18-21 registration seam: append registrar calls here, e.g.:
    //   registerGlobeResources(server, { userId: authResult.userId });
    //   registerGlobeCommandTools(server, { userId: authResult.userId });
    //   registerDataQueryTools(server, { userId: authResult.userId });
    // Each executor reads the latest route.ts before editing (R-1).

    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode (D-17-04)
    });

    // Optional chain for test-mock compatibility: the real SDK McpServer always
    // has connect(); optional chaining guards against a reset mock returning {}.
    await server?.connect?.(transport);

    // Build AuthInfo from the Phase 16 auth result.
    // token: empty string — we do not re-expose the raw Bearer value downstream.
    // clientId: userId (the MCP client identity for resource scoping in 18/20).
    // extra: carry keyId for audit/rate-limit use by future phases.
    const authInfo: AuthInfo = {
        token: "",
        clientId: authResult.userId,
        scopes: [],
        extra: { userId: authResult.userId, keyId: authResult.keyId },
    };

    // Optional chain: the real SDK transport always has handleRequest(); the
    // fallback Response guards against a test mock returning {} after resetAllMocks().
    const sdkResponse = await transport.handleRequest?.(request, { authInfo })
        ?? new Response(null, { status: 200 });

    // Ensure streaming headers are present (D-17-06, MCP-06, Pitfall 1).
    return withStreamingHeaders(sdkResponse);
}

// ---------------------------------------------------------------------------
// Route exports (App Router)
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
    return handleMcpRequest(request);
}
