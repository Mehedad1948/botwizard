-- Columns that exist in schema.prisma (and in databases created with `db push`)
-- but were never captured by a migration. Idempotent: no-op where they exist.

DO $$ BEGIN
  CREATE TYPE "ScheduleType" AS ENUM ('INTERVAL', 'SPECIFIC_TIMES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "scheduleType" "ScheduleType" NOT NULL DEFAULT 'INTERVAL';
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "specificTimes" TEXT[];
ALTER TABLE "Campaign" ALTER COLUMN "intervalHours" DROP NOT NULL;

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "sourceChatId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "sourceMessageId" INTEGER;
