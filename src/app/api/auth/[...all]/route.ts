/**
 * Better Auth API route handler.
 *
 * Mounted at /api/auth/[...all] — coexists with NextAuth's
 * /api/auth/[...nextauth] during the Phase 71 migration.
 *
 * Exports:
 *  - GET: session retrieval, CSRF token, JWKS (when JWT plugin added)
 *  - POST: sign-in, sign-up, sign-out, email verification, password reset
 *
 * The handler is minimal — toNextJsHandler(auth) generates all route
 * handlers from the Better Auth instance config.
 */
import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
