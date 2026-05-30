/**
 * RED tests for dynamic tools/list composition (Phase 21 Wave 0).
 *
 * These tests INTENTIONALLY FAIL because composePluginToolsList does not exist yet.
 * Wave 2 creates the composition helper that merges system tools with per-session
 * plugin-unique tools.
 *
 *   LIST-01  System tools (globe-commands + data-query) are always present in the output
 *   LIST-02  Per-session namespaced plugin tools are appended after system tools
 *   LIST-03  Duplicate namespaced names are de-duplicated (unique output)
 *   LIST-04  Each plugin tool description includes a capability-coverage sentence
 *            derived from its mcpCapabilities (capability copy per REPLAN decision 5)
 *   LIST-05  An empty session catalog produces system-tools-only output (no plugin tools)
 *
 * No real Redis or network calls -- all fixtures are in-memory.
 */

import { describe, it, expect } from "vitest";
import { composePluginToolsList } from "@/app/api/mcp/pluginToolsList";

// ---------------------------------------------------------------------------
// Types (mirrors what Wave 2 will export from pluginToolsList.ts)
// ---------------------------------------------------------------------------

/** Shape of an entry returned by composePluginToolsList. */
interface ComposedTool {
    name: string;
    description: string;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The canonical system tool names shipped in Phases 19a and 20. */
const SYSTEM_TOOL_NAMES = [
    "pan_globe",
    "focus_entity",
    "toggle_layer",
    "set_timeline",
    "search_entities",
    "get_entities_in_region",
    "get_entity_details",
    "get_plugin_data",
];

/** A fixture per-session catalog with one namespaced plugin tool. */
const FIXTURE_CATALOG_SINGLE = {
    tools: [
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Decodes an aviation squawk code.",
            inputSchema: { type: "object" as const, properties: { squawk: { type: "string" } } },
            mcpCapabilities: ["point-layer"],
        },
    ],
    capabilities: ["point-layer"],
};

/** A catalog with two tools, each from a different plugin, with different capabilities. */
const FIXTURE_CATALOG_MULTI = {
    tools: [
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Decodes an aviation squawk code.",
            inputSchema: { type: "object" as const },
            mcpCapabilities: ["point-layer", "aviation-data"],
        },
        {
            namespacedName: "maritime__decode_mmsi",
            pluginId: "maritime",
            description: "Decodes a maritime MMSI number.",
            inputSchema: { type: "object" as const },
            mcpCapabilities: ["point-layer"],
        },
    ],
    capabilities: ["point-layer"],
};

/** A duplicate catalog that repeats the same namespaced name. */
const FIXTURE_CATALOG_DUPLICATE = {
    tools: [
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "First copy.",
            inputSchema: { type: "object" as const },
            mcpCapabilities: ["point-layer"],
        },
        {
            namespacedName: "aviation__decode_squawk",
            pluginId: "aviation",
            description: "Duplicate copy -- must be de-duplicated.",
            inputSchema: { type: "object" as const },
            mcpCapabilities: ["point-layer"],
        },
    ],
    capabilities: ["point-layer"],
};

// ---------------------------------------------------------------------------
// LIST-01: system tools always present
// ---------------------------------------------------------------------------

describe("composePluginToolsList system tools always present (LIST-01)", () => {
    it("includes pan_globe, toggle_layer, and the Phase 20 data-query tools", () => {
        const result = composePluginToolsList(null) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);

        for (const systemName of SYSTEM_TOOL_NAMES) {
            expect(names).toContain(systemName);
        }
    });

    it("returns system tools even when the session catalog is empty", () => {
        const result = composePluginToolsList({ tools: [], capabilities: [] }) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);

        for (const systemName of SYSTEM_TOOL_NAMES) {
            expect(names).toContain(systemName);
        }
    });
});

// ---------------------------------------------------------------------------
// LIST-02: per-session plugin tools are appended
// ---------------------------------------------------------------------------

describe("composePluginToolsList appends plugin tools (LIST-02)", () => {
    it("includes the namespaced plugin tool from the session catalog", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_SINGLE) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);

        expect(names).toContain("aviation__decode_squawk");
    });

    it("includes all namespaced tools from a multi-tool catalog", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_MULTI) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);

        expect(names).toContain("aviation__decode_squawk");
        expect(names).toContain("maritime__decode_mmsi");
    });

    it("system tools come before plugin tools in the output array", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_SINGLE) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);

        const firstPluginIdx = names.indexOf("aviation__decode_squawk");
        // All system tools must appear before the first plugin tool
        for (const systemName of SYSTEM_TOOL_NAMES) {
            const sysIdx = names.indexOf(systemName);
            expect(sysIdx).toBeGreaterThanOrEqual(0);
            expect(sysIdx).toBeLessThan(firstPluginIdx);
        }
    });
});

// ---------------------------------------------------------------------------
// LIST-03: duplicate namespaced names are de-duplicated
// ---------------------------------------------------------------------------

describe("composePluginToolsList deduplicates (LIST-03)", () => {
    it("de-duplicates tools with the same namespaced name", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_DUPLICATE) as ComposedTool[];
        const pluginTools = result.filter((t: ComposedTool) => t.name === "aviation__decode_squawk");

        expect(pluginTools).toHaveLength(1);
    });

    it("total tool count is system tools + unique plugin tools", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_DUPLICATE) as ComposedTool[];
        // FIXTURE_CATALOG_DUPLICATE has 2 entries but they are the same name
        expect(result.length).toBe(SYSTEM_TOOL_NAMES.length + 1);
    });
});

// ---------------------------------------------------------------------------
// LIST-04: capability-coverage sentence in plugin tool descriptions
// ---------------------------------------------------------------------------

describe("composePluginToolsList capability copy in descriptions (LIST-04)", () => {
    it("appends capability info to the plugin tool description", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_SINGLE) as ComposedTool[];
        const aviationTool = result.find((t: ComposedTool) => t.name === "aviation__decode_squawk");

        // The description must reference the plugin's capability tags.
        // Wave 2 bakes capability copy into descriptions per REPLAN decision 5.
        expect(aviationTool).toBeDefined();
        expect(aviationTool!.description).toContain("point-layer");
    });

    it("multi-capability tool description includes all capability tags", () => {
        const result = composePluginToolsList(FIXTURE_CATALOG_MULTI) as ComposedTool[];
        const aviationTool = result.find((t: ComposedTool) => t.name === "aviation__decode_squawk");

        expect(aviationTool!.description).toContain("point-layer");
        expect(aviationTool!.description).toContain("aviation-data");
    });
});

// ---------------------------------------------------------------------------
// LIST-05: null / empty catalog yields system tools only
// ---------------------------------------------------------------------------

describe("composePluginToolsList with no catalog (LIST-05)", () => {
    it("returns only system tools when catalog is null (no active session)", () => {
        const result = composePluginToolsList(null) as ComposedTool[];
        const names = result.map((t: ComposedTool) => t.name);
        const hasPlugin = names.some((n: string) => n.includes("__"));
        expect(hasPlugin).toBe(false);
        expect(result.length).toBe(SYSTEM_TOOL_NAMES.length);
    });

    it("returns only system tools when catalog has no tools", () => {
        const result = composePluginToolsList({ tools: [], capabilities: [] }) as ComposedTool[];
        expect(result.length).toBe(SYSTEM_TOOL_NAMES.length);
    });
});
