-- Rebuild publishing engine: multi-destination campaigns, schedule rules,
-- delivery log/queue, destination health, stored post content, bot
-- conversation state and opaque webhook ids. Converts existing data.

-- ---------------------------------------------------------------- enums
CREATE TYPE "ScheduleKind" AS ENUM ('ONCE', 'INTERVAL', 'DAILY', 'WEEKLY');
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "DeliveryTrigger" AS ENUM ('SCHEDULED', 'MANUAL');
CREATE TYPE "ChatType" AS ENUM ('GROUP', 'SUPERGROUP', 'CHANNEL', 'UNKNOWN');
CREATE TYPE "DestinationStatus" AS ENUM ('ACTIVE', 'NO_PERMISSION', 'REMOVED');

ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'ANIMATION';
ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'AUDIO';

-- ---------------------------------------------------------------- bot
ALTER TABLE "Bot" ADD COLUMN "webhookId" TEXT,
ADD COLUMN "webhookSecret" TEXT;
CREATE UNIQUE INDEX "Bot_webhookId_key" ON "Bot"("webhookId");

-- ---------------------------------------------------------------- post
ALTER TABLE "Post" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "buttons" JSONB,
ADD COLUMN "entities" JSONB,
ADD COLUMN "mediaFileId" TEXT,
ADD COLUMN "title" TEXT;
CREATE INDEX "Post_botId_archivedAt_idx" ON "Post"("botId", "archivedAt");

-- Legacy media drafts stored a placeholder instead of a caption.
UPDATE "Post" SET "content" = NULL WHERE "content" = '🖼 مدیا/فایل';

-- ---------------------------------------------------------------- destinations
ALTER TABLE "ConnectedChat" ADD COLUMN "chatType" "ChatType" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "status" "DestinationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Campaigns created from the dashboard could target a chat id that was never
-- registered; make every targeted chat a destination.
INSERT INTO "ConnectedChat" ("id", "botId", "chatId", "chatTitle")
SELECT DISTINCT ON (c."botId", c."chatId")
  'mig_' || md5(c."botId" || ':' || c."chatId"), c."botId", c."chatId", c."chatTitle"
FROM "Campaign" c
ON CONFLICT ("botId", "chatId") DO NOTHING;

-- ---------------------------------------------------------------- campaign columns
ALTER TABLE "Campaign" ADD COLUMN "endsAt" TIMESTAMP(3),
ADD COLUMN "intervalMinutes" INTEGER,
ADD COLUMN "jitterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRunAt" TIMESTAMP(3),
ADD COLUMN "maxRuns" INTEGER,
ADD COLUMN "name" TEXT,
ADD COLUMN "runCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "scheduleKind" "ScheduleKind",
ADD COLUMN "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "times" TEXT[],
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
ADD COLUMN "weekdays" INTEGER[],
ALTER COLUMN "nextRun" DROP NOT NULL;

UPDATE "Campaign" SET
  "scheduleKind" = CASE WHEN "scheduleType" = 'SPECIFIC_TIMES' THEN 'DAILY'::"ScheduleKind" ELSE 'INTERVAL'::"ScheduleKind" END,
  "intervalMinutes" = CASE WHEN "scheduleType" = 'SPECIFIC_TIMES' THEN NULL ELSE GREATEST(COALESCE("intervalHours", 24), 1) * 60 END,
  "times" = CASE WHEN "scheduleType" = 'SPECIFIC_TIMES' THEN COALESCE("specificTimes", '{}') ELSE '{}' END,
  "weekdays" = '{}',
  "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"CampaignStatus" ELSE 'PAUSED'::"CampaignStatus" END,
  -- Interval grids continue from the already-planned next run.
  "startsAt" = CASE WHEN "scheduleType" = 'SPECIFIC_TIMES' THEN "createdAt" ELSE "nextRun" END,
  "jitterMinutes" = CASE WHEN "randomDelay" THEN 30 ELSE 0 END;

ALTER TABLE "Campaign" ALTER COLUMN "scheduleKind" SET NOT NULL;

-- ---------------------------------------------------------------- new tables
CREATE TABLE "CampaignTarget" (
    "campaignId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTarget_pkey" PRIMARY KEY ("campaignId","destinationId")
);

CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "destinationId" TEXT,
    "chatId" TEXT NOT NULL,
    "chatTitle" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "trigger" "DeliveryTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "errorKind" TEXT,
    "errorMessage" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotConversation" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------- merge sibling campaigns
-- Rows created by one owner action share subscriberAudienceKey (same bot+post).
CREATE TEMP TABLE campaign_merge AS
SELECT
  c."id" AS campaign_id,
  FIRST_VALUE(c."id") OVER (
    PARTITION BY c."botId", c."postId", COALESCE(c."subscriberAudienceKey", c."id")
    ORDER BY c."createdAt", c."id"
  ) AS canonical_id,
  c."chatId" AS chat_id,
  c."chatTitle" AS chat_title,
  c."botId" AS bot_id
FROM "Campaign" c;

INSERT INTO "CampaignTarget" ("campaignId", "destinationId")
SELECT m.canonical_id, cc."id"
FROM campaign_merge m
JOIN "ConnectedChat" cc ON cc."botId" = m.bot_id AND cc."chatId" = m.chat_id
ON CONFLICT DO NOTHING;

INSERT INTO "Delivery" (
  "id", "botId", "campaignId", "destinationId", "chatId", "chatTitle",
  "occurrenceKey", "trigger", "status", "runAt", "attempts", "errorKind",
  "errorMessage", "sentAt", "createdAt", "updatedAt"
)
SELECT
  h."id", m.bot_id, m.canonical_id, cc."id", m.chat_id, m.chat_title,
  'legacy:' || h."id", 'MANUAL',
  CASE WHEN h."status" = 'SUCCESS' THEN 'SENT'::"DeliveryStatus" ELSE 'FAILED'::"DeliveryStatus" END,
  h."sentAt", 1,
  CASE WHEN h."status" = 'SUCCESS' THEN NULL ELSE 'TERMINAL' END,
  h."errorLog",
  CASE WHEN h."status" = 'SUCCESS' THEN h."sentAt" ELSE NULL END,
  h."sentAt", h."sentAt"
FROM "PostHistory" h
JOIN campaign_merge m ON m.campaign_id = h."campaignId"
LEFT JOIN "ConnectedChat" cc ON cc."botId" = m.bot_id AND cc."chatId" = m.chat_id;

UPDATE "Campaign" c SET
  "notifySubscribers" = g.notify,
  "jitterMinutes" = g.jitter,
  "status" = CASE WHEN g.any_active THEN 'ACTIVE'::"CampaignStatus" ELSE 'PAUSED'::"CampaignStatus" END
FROM (
  SELECT m.canonical_id,
         BOOL_OR(x."notifySubscribers") AS notify,
         BOOL_OR(x."isActive") AS any_active,
         MAX(x."jitterMinutes") AS jitter
  FROM campaign_merge m JOIN "Campaign" x ON x."id" = m.campaign_id
  GROUP BY m.canonical_id
) g
WHERE c."id" = g.canonical_id;

UPDATE "SubscriberNotificationDispatch" d SET "campaignId" = m.canonical_id
FROM campaign_merge m
WHERE d."campaignId" = m.campaign_id AND m.campaign_id <> m.canonical_id;

DELETE FROM "Campaign" c
USING campaign_merge m
WHERE c."id" = m.campaign_id AND m.campaign_id <> m.canonical_id;

-- ---------------------------------------------------------------- drop legacy
ALTER TABLE "PostHistory" DROP CONSTRAINT "PostHistory_campaignId_fkey";
DROP TABLE "PostHistory";
DROP TABLE campaign_merge;

ALTER TABLE "Campaign" DROP COLUMN "chatId",
DROP COLUMN "chatTitle",
DROP COLUMN "intervalHours",
DROP COLUMN "isActive",
DROP COLUMN "randomDelay",
DROP COLUMN "scheduleType",
DROP COLUMN "specificTimes",
DROP COLUMN "subscriberAudienceKey";

DROP TYPE "ScheduleType";
DROP TYPE "SendStatus";

-- ---------------------------------------------------------------- indexes and keys
CREATE INDEX "CampaignTarget_destinationId_idx" ON "CampaignTarget"("destinationId");
CREATE INDEX "Delivery_status_runAt_idx" ON "Delivery"("status", "runAt");
CREATE INDEX "Delivery_campaignId_createdAt_idx" ON "Delivery"("campaignId", "createdAt");
CREATE INDEX "Delivery_botId_createdAt_idx" ON "Delivery"("botId", "createdAt");
CREATE UNIQUE INDEX "Delivery_campaignId_chatId_occurrenceKey_key" ON "Delivery"("campaignId", "chatId", "occurrenceKey");
CREATE INDEX "BotConversation_botId_chatId_idx" ON "BotConversation"("botId", "chatId");
CREATE INDEX "BotConversation_expiresAt_idx" ON "BotConversation"("expiresAt");
CREATE INDEX "Campaign_status_nextRun_idx" ON "Campaign"("status", "nextRun");
CREATE INDEX "Campaign_botId_createdAt_idx" ON "Campaign"("botId", "createdAt");

ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "ConnectedChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "ConnectedChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BotConversation" ADD CONSTRAINT "BotConversation_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
