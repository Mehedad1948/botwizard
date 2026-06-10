-- CreateEnum
CREATE TYPE "BotPlatform" AS ENUM ('TELEGRAM', 'BALE');

-- AlterTable
ALTER TABLE "Bot"
ADD COLUMN "platform" "BotPlatform" NOT NULL DEFAULT 'TELEGRAM',
ADD COLUMN "ownerPlatformUserId" TEXT,
ADD COLUMN "connectionCodeHash" TEXT,
ADD COLUMN "connectionCodeExpiresAt" TIMESTAMP(3);

-- Backfill Telegram ownership from the existing linked Telegram account.
UPDATE "Bot"
SET "ownerPlatformUserId" = "User"."telegramId"
FROM "User"
WHERE "Bot"."userId" = "User"."id"
  AND "Bot"."ownerPlatformUserId" IS NULL;

-- Replace global token uniqueness with platform-scoped uniqueness.
DROP INDEX IF EXISTS "Bot_token_key";
CREATE UNIQUE INDEX "Bot_platform_token_key" ON "Bot"("platform", "token");
CREATE INDEX "Bot_userId_platform_idx" ON "Bot"("userId", "platform");
