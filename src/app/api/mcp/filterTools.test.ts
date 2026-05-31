import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/globeCommandQueue");
vi.mock("@/lib/mcpSessionCatalog");

// RED: ./filterTools does not exist yet. This import fails at collection time,
// locking the three-tool contract (set_filter, clear_filter, get_plugin_filters).
import { registerFilterTools } from "./filterTools";
import { enqueueGlobeCommand, resolveActiveSessionId } from "@/lib/globeCommandQueue";
import { readSessionCatalog } from "@/lib/mcpSessionCatalog";

const mockEnqueue = vi.mocked(enqueueGlobeCommand);
const mockResolveActiveSessionId = vi.mocked(resolveActiveSessionId);
const mockReadSessionCatalog = vi.mocked(readSessionCatalog);

const handlers: Record<string, (args: unknown) => unknown> = {};
const mockServer = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: (args: unknown) => unknown) => {
        handlers[name] = handler;
    }),
};

const ctx = { userId: "u1" };

function textOf(result: unknown): string {
    return (result as { content: Array<{ text: string }> }).content[0].text;
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    mockResolveActiveSessionId.mockResolvedValue("sess-abc");
    registerFilterTools(mockServer as never, ctx);
});

describe("set_filter tool handler", () => {
    it("enqueues a setFilter command with pluginId and filters", async () => {
        await handlers["set_filter"]({
            pluginId: "flights",
            filters: { status: { type: "select", values: ["airborne"] } },
        });

        expect(mockEnqueue).toHaveBeenCalledWith(
            "u1",
            "sess-abc",
            { type: "setFilter", pluginId: "flights", filters: { status: { type: "select", values: ["airborne"] } } },
        );
    });

    it("returns NO_SESSION text and does not enqueue when no active session", async () => {
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["set_filter"]({ pluginId: "flights", filters: {} });

        expect(textOf(result)).toMatch(/no active globe session/i);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });
});

describe("clear_filter tool handler", () => {
    it("enqueues clearFilter without a pluginId field when pluginId omitted", async () => {
        await handlers["clear_filter"]({});

        expect(mockEnqueue).toHaveBeenCalledWith("u1", "sess-abc", { type: "clearFilter" });
    });

    it("enqueues clearFilter with pluginId when provided", async () => {
        await handlers["clear_filter"]({ pluginId: "flights" });

        expect(mockEnqueue).toHaveBeenCalledWith("u1", "sess-abc", { type: "clearFilter", pluginId: "flights" });
    });
});

describe("get_plugin_filters tool handler", () => {
    it("returns the plugin's filterDefinitions array as JSON", async () => {
        const defs = [{ id: "status", label: "Status", type: "select", propertyKey: "status" }];
        mockReadSessionCatalog.mockResolvedValue({
            tools: [],
            capabilities: [],
            filterDefinitions: { flights: defs },
        } as never);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(JSON.parse(textOf(result))).toEqual(defs);
    });

    it("returns [] when there is no active session", async () => {
        mockResolveActiveSessionId.mockResolvedValue(null);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(JSON.parse(textOf(result))).toEqual([]);
    });

    it("returns [] when catalog has no entry for the plugin", async () => {
        mockReadSessionCatalog.mockResolvedValue({
            tools: [],
            capabilities: [],
            filterDefinitions: {},
        } as never);

        const result = await handlers["get_plugin_filters"]({ pluginId: "flights" });

        expect(JSON.parse(textOf(result))).toEqual([]);
    });
});
