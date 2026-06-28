import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/ba-session";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { isCloud } from "@/core/edition";

/**
 * POST /api/auth/revoke: "sign out everywhere".
 *
 * Calls Better Auth `auth.api.signOut()` to invalidate the current session
 * server-side, then increments `sessionVersion` to invalidate ALL sessions
 * for this user (same pattern as the old NextAuth behavior).
 *
 * Requires an authenticated session. Same-origin only in practice: the session
 * cookie is `sameSite=lax`, so a cross-site POST carries no credentials.
 */
export async function POST() {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cloud identities are managed by Supabase; there is no local users row to bump.
    if (!isCloud) {
        await prisma.user.update({
            where: { id: userId },
            data: { sessionVersion: { increment: 1 } },
        });
    }

    // Invalidate the current session server-side
    await auth.api.signOut({ headers: new Headers() });
    return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
