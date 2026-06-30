import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import type { JWT } from "next-auth/jwt";
import {
 isDemo, isCloud, getDemoAdminSecret, DEMO_ADMIN_ROLE, isHttpsDeployment
} from "@/core/edition";
import { authConfig } from "@/lib/auth.config";
import { SupabaseAdapter } from "@auth/supabase-adapter";

// ---------------------------------------------------------------------------
// Hardcoded constants for the demo-admin synthetic identity. These mirror the
// values minted in authorize() and must never be derived from request input.
// ---------------------------------------------------------------------------
export const DEMO_ADMIN_ID = "demo-admin";
export const DEMO_ADMIN_EMAIL = "admin@worldwideview.local";
export const DEMO_ADMIN_NAME = "Demo Admin";
// Sentinel stored in hashedPassword for identities that never use bcrypt auth.
// A bcrypt hash always starts with "$2", so this value can never match one and
// compareSync against it always returns false -- the row cannot be used to log
// in via the password flow.
export const DEMO_ADMIN_PW_SENTINEL = "!demo-no-password";

// ---------------------------------------------------------------------------
// Upsert the local user row so that session.user.id always has a matching
// `users` record, even after a DB reset or first-time setup. Scoped strictly
// to non-cloud editions. We never create a user from untrusted input -- callers
// must supply server-controlled constants only.
// hashedPassword defaults to the sentinel for synthetic identities (demo-admin)
// that authenticate via a separate mechanism and never use the password flow.
// ---------------------------------------------------------------------------
export async function ensureLocalUserPersisted(params: {
    id: string;
    email: string;
    name: string;
    role: string;
    hashedPassword?: string;
}): Promise<void> {
    await prisma.user.upsert({
        where: { id: params.id },
        update: {},
        create: {
            id: params.id,
            email: params.email,
            name: params.name,
            role: params.role,
            hashedPassword: params.hashedPassword ?? DEMO_ADMIN_PW_SENTINEL,
        },
    });
}

// ---------------------------------------------------------------------------
// Exported for unit testing: handles the demo-admin upsert on initial sign-in.
// Called from the jwt callback with `user` present (initial sign-in only).
// Guards: non-cloud editions, demo-admin id only, server-controlled constants.
// ---------------------------------------------------------------------------
export async function persistDemoAdminIfNeeded(
    userId: string,
    cloudEdition: boolean,
): Promise<void> {
    if (cloudEdition || userId !== DEMO_ADMIN_ID) return;
    await ensureLocalUserPersisted({
        id: DEMO_ADMIN_ID,
        email: DEMO_ADMIN_EMAIL,
        name: DEMO_ADMIN_NAME,
        role: DEMO_ADMIN_ROLE,
    });
}

// Extract local credentials logic to a helper
const localCredentialsProvider = Credentials({
    credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // Demo edition: virtual admin login (no DB user required)
        const adminSecret = getDemoAdminSecret();
        const secretMatch = adminSecret
            && password.length === adminSecret.length
            && timingSafeEqual(Buffer.from(password), Buffer.from(adminSecret));
        if (isDemo && secretMatch && email === "admin") {
            return {
                id: "demo-admin",
                name: "Demo Admin",
                email: "admin",
                role: DEMO_ADMIN_ROLE,
                sessionVersion: 0,
            };
        }

        const betterUser = await prisma.betterAuthUser.findFirst({
            where: { email },
        });
        if (!betterUser) return null;

        const account = await prisma.betterAuthAccount.findFirst({
            where: {
                userId: betterUser.id,
                providerId: 'credential',
            },
        });
        if (!account || !account.password) return null;

        const isValid = compareSync(password, account.password);
        if (!isValid) return null;

        // On the local edition, upsert the user row so that session.user.id
        // always corresponds to a real `users` record even after a DB reset.
        // Cloud users are managed by Supabase Auth (never reaches this branch).
        // ADR-0008: Remove with NextAuth (Phase 73). All editions should upsert local user.
        if (!isCloud) {
            await ensureLocalUserPersisted({
                id: betterUser.id,
                email: betterUser.email,
                name: betterUser.name,
                role: betterUser.role,
            });
        }

        return {
            id: betterUser.id,
            name: betterUser.name,
            email: betterUser.email,
            role: betterUser.role,
            sessionVersion: 0,
        };
    },
});

// True when the deployment serves over https (session cookie gets the secure
// flag / __Secure- prefix). Shared with the edge proxy reader via
// isHttpsDeployment() so the cookie writer and reader never disagree on the
// __Secure- prefix behind a TLS-terminating reverse proxy.
const isSecureDeploy = isHttpsDeployment();

/**
 * Authoritative session revocation check, run from the jwt callback on every
 * non-sign-in request (local/demo editions). Returns the token unchanged when
 * still valid, or `null` to invalidate the session when:
 *  - the user row no longer exists (deleted, or the token was minted against a
 *    different database, e.g. another worktree/instance even with a shared
 *    AUTH_SECRET), or
 *  - the user's sessionVersion was bumped (logout-everywhere / credential
 *    rotation), making the token's embedded version stale.
 */
export async function revalidateSession(token: JWT): Promise<JWT | null> {
    const userId = token.id;
    if (typeof userId !== "string" || !userId) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { sessionVersion: true, role: true },
    });
    if (!dbUser) return null;

    const tokenVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
    if (dbUser.sessionVersion !== tokenVersion) return null;

    // Keep role fresh in case it changed server-side since the token was issued.
    token.role = dbUser.role;
    return token;
}

export const {
 handlers, auth, signIn, signOut
} = NextAuth({
    ...authConfig,
    session: {
        strategy: "jwt",
        // Bound the lifetime of the signature-only token. The edge proxy gate
        // verifies the JWT signature but cannot reach the DB (no Prisma on the
        // edge runtime), so a shorter maxAge limits how long a leaked-but-
        // unexpired token can reach pages before the authoritative revocation
        // check (revalidateSession) rejects it on any auth() call.
        maxAge: 7 * 24 * 60 * 60, // 7 days
        updateAge: 24 * 60 * 60, // sliding refresh, at most once per day
    },
    // Explicit, hardened cookie options. These pin NextAuth's secure defaults so
    // they cannot silently regress: httpOnly blocks JS access (XSS token theft),
    // sameSite=lax blocks cross-site sends (CSRF), secure requires https in prod.
    cookies: {
        sessionToken: {
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: isSecureDeploy,
            },
        },
    },
    // ADR-0008: This edition-conditional Supabase adapter violates dual-auth. Remove with NextAuth (Phase 73).
    adapter: isCloud ? SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://dummy.supabase.co",
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy",
    }) as never : undefined,
    providers: [localCredentialsProvider],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            // Initial sign-in: copy identity claims from the authorized user.
            if (user) {
                token.role = user.role ?? "user";
                token.id = user.id;
                // Embed the user's current sessionVersion so the token can be
                // compared against the DB on later requests and revoked.
                token.sessionVersion = user.sessionVersion ?? 0;
                // Persist the demo-admin synthetic identity on first sign-in so
                // that the `users` FK target exists for API key creation. Runs
                // only when `user` is present (initial sign-in, not token refresh).
                // All values inside come from server-controlled constants.
                await persistDemoAdminIfNeeded(user.id!, isCloud);
                return token;
            }

            // Every subsequent request re-validates the token against the DB so
            // that deleted users, cross-database tokens, and bumped
            // sessionVersions are rejected. Cloud identities live in Supabase
            // (no local `users` row), so they skip the Prisma comparison.
            // ADR-0008: Remove with NextAuth (Phase 73). Cloud should not skip session revalidation.
            if (isCloud) return token;
            return revalidateSession(token);
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string | undefined;
            }
            return session;
        },
    },
});
