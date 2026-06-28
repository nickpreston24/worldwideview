"use server";

import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/db";

interface SetupResult {
    success: boolean;
    error?: string;
}

/** Create the initial admin account. Rejects if any user already exists.
 *
 * Creates records in BOTH Better Auth tables (user + account) so the
 * admin can log in via Better Auth client SDK. The account uses the
 * "credential" providerId for email/password authentication.
 */
export async function createAdminAccount(formData: FormData): Promise<SetupResult> {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (!name || !email || !password) {
        return { success: false, error: "All fields are required." };
    }
    if (password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters." };
    }
    if (password !== confirm) {
        return { success: false, error: "Passwords do not match." };
    }

    const existingCount = await prisma.betterAuthUser.count();
    if (existingCount > 0) {
        return { success: false, error: "Admin account already exists." };
    }

    const userId = crypto.randomUUID();
    const hashedPassword = hashSync(password, 12);

    await prisma.$transaction([
        prisma.betterAuthUser.create({
            data: {
                id: userId,
                email,
                name,
                emailVerified: false,
            },
        }),
        prisma.betterAuthAccount.create({
            data: {
                id: crypto.randomUUID(),
                accountId: email,
                providerId: "credential",
                userId: userId,
                password: hashedPassword,
            },
        }),
    ]);

    return { success: true };
}
