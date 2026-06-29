/**
 * Better Auth API route handler.
 *
 * Mounted at /api/ba/[...all] to avoid catch-all collision with NextAuth's
 * /api/auth/[...nextauth] during the Phase 71 migration coexistence period.
 *
 * Exports:
 *  - GET: session retrieval, CSRF token, JWKS (when JWT plugin added)
 *  - POST: sign-in, sign-up, sign-out, email verification, password reset
 *
 * The handler wraps toNextJsHandler(auth) to catch errors and return a
 * JSON body — Better Auth's default 500 has no body, making CI debugging
 * impossible. This wrapper surfaces the error message in the response.
 */
import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

const { GET: rawGET, POST: rawPOST } = toNextJsHandler(auth);

function wrapHandler(handler: typeof rawGET): typeof rawGET {
    return async (request: Request) => {
        try {
            return await handler(request);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[BA Route] Error:", message);
            if (error instanceof Error && error.stack) {
                console.error("[BA Route] Stack:", error.stack);
            }
            return Response.json(
                { error: "BA handler error", message },
                { status: 500 }
            );
        }
    };
}

export const GET = wrapHandler(rawGET);
export const POST = wrapHandler(rawPOST);
