/**
 * Tests for the demo-admin identity persistence helpers in auth.ts.
 *
 * We test the exported pure functions directly rather than fighting the
 * NextAuth factory boundary. `persistDemoAdminIfNeeded` encapsulates the
 * jwt-callback guard logic and delegates to `ensureLocalUserPersisted`.
 */
import {
    describe, it, expect, vi, beforeEach
} from "vitest";

// The global setup.ts mocks @/lib/auth entirely (to stop next-auth importing
// next/server in jsdom). We need the real module here, so unmock it first.
vi.unmock("@/lib/auth");

// ---------------------------------------------------------------------------
// Mock prisma before importing auth.ts so the module sees the mock.
// vi.hoisted() runs before all vi.mock() factories, so the variable is
// defined before the hoisted factory closure captures it.
// ---------------------------------------------------------------------------
const {
    mockUpsert, mockFindUnique,
    mockBetterAuthUserFindFirst, mockBetterAuthAccountFindFirst,
    mockCompareSync, mockGetDemoAdminSecret,
    capturedAuthorize, mockCredentials,
} = vi.hoisted(() => {
    const captured = { current: null as ((creds: Record<string, unknown>) => Promise<unknown>) | null };
    return {
        mockUpsert: vi.fn().mockResolvedValue(undefined),
        mockFindUnique: vi.fn(),
        mockBetterAuthUserFindFirst: vi.fn(),
        mockBetterAuthAccountFindFirst: vi.fn(),
        mockCompareSync: vi.fn(() => false),
        mockGetDemoAdminSecret: vi.fn(() => undefined),
        capturedAuthorize: captured,
        mockCredentials: vi.fn((opts: { authorize: typeof captured.current }) => {
            captured.current = opts.authorize;
            return { id: "credentials", name: "Credentials" };
        }),
    };
});

const editionState = vi.hoisted(() => ({ isCloud: false, isDemo: false }));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: {
            upsert: mockUpsert,
            findFirst: vi.fn(),
            findUnique: mockFindUnique,
        },
        betterAuthUser: { findFirst: mockBetterAuthUserFindFirst },
        betterAuthAccount: { findFirst: mockBetterAuthAccountFindFirst },
    },
}));

// next-auth and its provider must be mocked to prevent NextAuth() runtime init.
vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
    })),
}));
vi.mock("next-auth/providers/credentials", () => ({
    default: mockCredentials,
}));
vi.mock("@auth/supabase-adapter", () => ({
    SupabaseAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth.config", () => ({
    authConfig: { callbacks: {}, providers: [] },
}));
vi.mock("@/core/edition", () => ({
    get isCloud() { return editionState.isCloud; },
    get isDemo() { return editionState.isDemo; },
    getDemoAdminSecret: mockGetDemoAdminSecret,
    DEMO_ADMIN_ROLE: "demo-admin",
    isHttpsDeployment: vi.fn(() => false),
}));
vi.mock("bcryptjs", () => ({ compareSync: mockCompareSync }));

// Import after mocks.
import {
    persistDemoAdminIfNeeded,
    ensureLocalUserPersisted,
    revalidateSession,
    DEMO_ADMIN_ID,
    DEMO_ADMIN_EMAIL,
    DEMO_ADMIN_NAME,
    DEMO_ADMIN_PW_SENTINEL,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// ensureLocalUserPersisted
// ---------------------------------------------------------------------------
describe("ensureLocalUserPersisted", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls prisma.user.upsert with the supplied params", async () => {
        await ensureLocalUserPersisted({
            id: "user-abc",
            email: "test@example.com",
            name: "Test User",
            role: "user",
            hashedPassword: "$2b$10$fakehash",
        });

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const call = mockUpsert.mock.calls[0][0];
        expect(call.where).toEqual({ id: "user-abc" });
        expect(call.create.hashedPassword).toBe("$2b$10$fakehash");
        expect(call.update).toEqual({});
    });

    it("defaults hashedPassword to the sentinel when omitted", async () => {
        await ensureLocalUserPersisted({
            id: "demo-admin",
            email: DEMO_ADMIN_EMAIL,
            name: DEMO_ADMIN_NAME,
            role: "demo-admin",
        });

        const call = mockUpsert.mock.calls[0][0];
        expect(call.create.hashedPassword).toBe(DEMO_ADMIN_PW_SENTINEL);
        // Sentinel must not look like a bcrypt hash -- bcrypt always starts with "$2"
        expect(DEMO_ADMIN_PW_SENTINEL.startsWith("$2")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// persistDemoAdminIfNeeded
// ---------------------------------------------------------------------------
describe("persistDemoAdminIfNeeded -- jwt callback guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls ensureLocalUserPersisted with demo-admin constants on initial sign-in", async () => {
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, false);

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const call = mockUpsert.mock.calls[0][0];
        expect(call.where).toEqual({ id: DEMO_ADMIN_ID });
        expect(call.create.id).toBe(DEMO_ADMIN_ID);
        expect(call.create.email).toBe(DEMO_ADMIN_EMAIL);
        expect(call.create.name).toBe(DEMO_ADMIN_NAME);
        expect(call.create.role).toBe("demo-admin");
        expect(call.create.hashedPassword).toBe(DEMO_ADMIN_PW_SENTINEL);
        // idempotent upsert -- update must be empty
        expect(call.update).toEqual({});
    });

    it("does NOT call upsert when isCloud is true", async () => {
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, true);

        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("does NOT call upsert for a non-demo-admin user id", async () => {
        await persistDemoAdminIfNeeded("regular-user-uuid", false);

        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("does NOT call upsert when both cloud=true and id=demo-admin", async () => {
        // Cloud edition takes precedence even if the id somehow matches.
        await persistDemoAdminIfNeeded(DEMO_ADMIN_ID, true);

        expect(mockUpsert).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// revalidateSession -- authoritative JWT revocation check
// ---------------------------------------------------------------------------
describe("revalidateSession -- jwt revocation check", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when the token carries no user id", async () => {
        const result = await revalidateSession({});
        expect(result).toBeNull();
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("returns null when the user no longer exists in the DB (deleted / cross-database token)", async () => {
        mockFindUnique.mockResolvedValue(null);
        const result = await revalidateSession({ id: "missing-user", sessionVersion: 0 });
        expect(result).toBeNull();
    });

    it("returns null when the token sessionVersion is stale (revoked / logout-everywhere)", async () => {
        mockFindUnique.mockResolvedValue({ sessionVersion: 3, role: "user" });
        const result = await revalidateSession({ id: "u1", sessionVersion: 2 });
        expect(result).toBeNull();
    });

    it("returns the token with role refreshed when the version matches", async () => {
        mockFindUnique.mockResolvedValue({ sessionVersion: 5, role: "admin" });
        const result = await revalidateSession({ id: "u1", sessionVersion: 5, role: "user" });
        expect(result).not.toBeNull();
        expect((result as { role?: string }).role).toBe("admin");
    });

    it("treats a missing token sessionVersion as 0", async () => {
        mockFindUnique.mockResolvedValue({ sessionVersion: 0, role: "user" });
        const result = await revalidateSession({ id: "u1" });
        expect(result).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// authorize -- local credentials provider (Better Auth models)
// ---------------------------------------------------------------------------
describe("authorize -- local credentials provider", () => {
    const validCredentials = { email: "user@test.com", password: "secret" };
    const betterUser = { id: "ba-uuid", email: "user@test.com", name: "Test User", role: "user" };
    const betterAccount = { id: "acct-1", userId: "ba-uuid", providerId: "credential", password: "$2b$10$hashedpassword" };

    beforeEach(() => {
        vi.clearAllMocks();
        editionState.isCloud = false;
        editionState.isDemo = false;
        mockBetterAuthUserFindFirst.mockReset();
        mockBetterAuthAccountFindFirst.mockReset();
        mockCompareSync.mockReset();
    });

    it("returns the user object on success (non-cloud)", async () => {
        mockBetterAuthUserFindFirst.mockResolvedValue(betterUser);
        mockBetterAuthAccountFindFirst.mockResolvedValue(betterAccount);
        mockCompareSync.mockReturnValue(true);

        const result = await capturedAuthorize.current!(validCredentials) as Record<string, unknown>;

        expect(result).not.toBeNull();
        expect(result.id).toBe("ba-uuid");
        expect(result.email).toBe("user@test.com");
        expect(result.name).toBe("Test User");
        expect(result.role).toBe("user");
        expect(result.sessionVersion).toBe(0);
        expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it("returns null when Better Auth user is not found", async () => {
        mockBetterAuthUserFindFirst.mockResolvedValue(null);

        const result = await capturedAuthorize.current!(validCredentials);

        expect(result).toBeNull();
        expect(mockBetterAuthAccountFindFirst).not.toHaveBeenCalled();
    });

    it("returns null when Better Auth account is not found", async () => {
        mockBetterAuthUserFindFirst.mockResolvedValue(betterUser);
        mockBetterAuthAccountFindFirst.mockResolvedValue(null);

        const result = await capturedAuthorize.current!(validCredentials);

        expect(result).toBeNull();
        expect(mockCompareSync).not.toHaveBeenCalled();
    });

    it("returns null when the account has no password stored", async () => {
        mockBetterAuthUserFindFirst.mockResolvedValue(betterUser);
        mockBetterAuthAccountFindFirst.mockResolvedValue({ ...betterAccount, password: null });

        const result = await capturedAuthorize.current!(validCredentials);

        expect(result).toBeNull();
    });

    it("returns null when the password does not match", async () => {
        mockBetterAuthUserFindFirst.mockResolvedValue(betterUser);
        mockBetterAuthAccountFindFirst.mockResolvedValue(betterAccount);
        mockCompareSync.mockReturnValue(false);

        const result = await capturedAuthorize.current!(validCredentials);

        expect(result).toBeNull();
    });

    it("returns null when email or password is empty", async () => {
        const result1 = await capturedAuthorize.current!({ email: "", password: "x" });
        expect(result1).toBeNull();

        const result2 = await capturedAuthorize.current!({ email: "x", password: "" });
        expect(result2).toBeNull();

        const result3 = await capturedAuthorize.current!({});
        expect(result3).toBeNull();
    });

    it("skips the local user upsert on cloud edition", async () => {
        editionState.isCloud = true;
        mockBetterAuthUserFindFirst.mockResolvedValue(betterUser);
        mockBetterAuthAccountFindFirst.mockResolvedValue(betterAccount);
        mockCompareSync.mockReturnValue(true);

        const result = await capturedAuthorize.current!(validCredentials) as Record<string, unknown>;

        expect(result).not.toBeNull();
        expect(mockUpsert).not.toHaveBeenCalled();
    });
});
