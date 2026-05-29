import { randomBytes } from "crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12;

/**
 * Pre-baked cost-12 bcrypt hash of "__wwv_dummy_timing_sentinel__".
 * Used as the fallback hash on prefix-miss to ensure a real bcrypt compare
 * always runs, defeating timing-oracle attacks (T-16-01).
 *
 * The literal eliminates the cold-start gap: if the async refresh below
 * has not resolved yet, this literal is already a valid cost-12 hash.
 * Generated via: node -e "import('bcryptjs').then(b=>b.hash('__wwv_dummy_timing_sentinel__',12).then(h=>console.log(h)))"
 */
let DUMMY_HASH = "$2b$12$k7QzlrAVpeJbV21EIU0zjOwqzh38Xyjs2oJLpBzkjPVyH7Puf.qEm";

// Refresh async at module load (harmless if this races with the literal)
hash("__wwv_dummy_timing_sentinel__", BCRYPT_COST).then((h) => {
    DUMMY_HASH = h;
});

// ---------------------------------------------------------------------------
// lastUsedAt throttle: at most one DB write per key per 60 seconds
// ---------------------------------------------------------------------------

const lastUsedAtThrottle = new Map<string, number>();
const LAST_USED_THROTTLE_MS = 60_000;

// ---------------------------------------------------------------------------
// Interfaces (exported for consumers — API-01)
// ---------------------------------------------------------------------------

export interface GeneratedKey {
    /** e.g. "wwv_KpKF4LhL" — stored plaintext in DB as lookup handle */
    prefix: string;
    /** 32-byte base64url — shown to user ONCE, never stored */
    secret: string;
    /** bcrypt(secret, 12) — stored in DB */
    hashedSecret: string;
    /** "wwv_KpKF4LhL.3EqV...1k0" — the full bearer token, shown once */
    fullToken: string;
}

export interface AuthenticatedKey {
    userId: string;
    keyId: string;
}

// ---------------------------------------------------------------------------
// generateApiKey — KEY-01, KEY-02
// ---------------------------------------------------------------------------

/**
 * Generates a new API key pair.
 * - prefix: "wwv_" + 8 url-safe chars (stored plaintext; used as DB lookup key)
 * - secret: 43 url-safe chars from 32 random bytes (returned ONCE, never stored)
 * - hashedSecret: bcrypt(secret, 12) — what gets persisted
 * - fullToken: combined bearer value shown to the user exactly once
 */
export async function generateApiKey(): Promise<GeneratedKey> {
    // randomBytes(6) -> 8 base64url chars (no padding)
    const prefix = "wwv_" + randomBytes(6).toString("base64url");
    // randomBytes(32) -> 43 base64url chars
    const secret = randomBytes(32).toString("base64url");
    const hashedSecret = await hash(secret, BCRYPT_COST);
    return {
        prefix,
        secret,
        hashedSecret,
        fullToken: `${prefix}.${secret}`,
    };
}

// ---------------------------------------------------------------------------
// authenticateApiKey — API-01, KEY-02
// ---------------------------------------------------------------------------

/**
 * Resolves an "Authorization: Bearer wwv_<prefix>.<secret>" header to the
 * owning user. Returns null (never throws) on any failure path.
 *
 * Timing-oracle defense (T-16-01): a bcrypt compare always executes even
 * when the prefix is not found in the DB, using the pre-baked DUMMY_HASH.
 * This ensures the miss path and the wrong-secret path are indistinguishable
 * by latency.
 */
export async function authenticateApiKey(
    request: Request,
): Promise<AuthenticatedKey | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7).trim();
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) return null;

    const prefix = token.substring(0, dotIdx);
    const secret = token.substring(dotIdx + 1);

    const row = await prisma.userApiKey.findUnique({
        where: { prefix },
        select: { id: true, userId: true, hashedSecret: true },
    });

    // Always run a compare — on miss use DUMMY_HASH to defeat timing oracle
    const hashToCompare = row?.hashedSecret ?? DUMMY_HASH;
    const isValid = await compare(secret, hashToCompare);

    if (!row || !isValid) return null;

    // Fire-and-forget lastUsedAt — throttled to 1 write/min per key (T-16-05)
    const now = Date.now();
    const lastWrite = lastUsedAtThrottle.get(row.id) ?? 0;
    if (now - lastWrite > LAST_USED_THROTTLE_MS) {
        lastUsedAtThrottle.set(row.id, now);
        void prisma.userApiKey.update({
            where: { id: row.id },
            data: { lastUsedAt: new Date() },
        }).catch(() => { /* intentional — never block the request */ });
    }

    return { userId: row.userId, keyId: row.id };
}
