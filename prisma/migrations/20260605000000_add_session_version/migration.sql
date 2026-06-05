-- Add sessionVersion to users table.
-- Existing rows default to 0, which matches the @default(0) in schema.prisma.
-- This column is embedded in every JWT at sign-in; bumping it invalidates all
-- existing sessions for that user (logout-everywhere / credential rotation).
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
