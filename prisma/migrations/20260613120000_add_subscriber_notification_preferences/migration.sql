CREATE TYPE "SubscriberStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'BLOCKED');
CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'BLOCKED');

ALTER TABLE "Campaign"
ADD COLUMN "notifySubscribers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "subscriberAudienceKey" TEXT;

CREATE TABLE "BotSubscriber" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "platformUserId" TEXT NOT NULL,
  "privateChatId" TEXT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "languageCode" TEXT,
  "status" "SubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT,
  "startParameter" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationTopic" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "callbackKey" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriberTopicSubscription" (
  "id" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriberTopicSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostNotificationTopic" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostNotificationTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriberNotificationDispatch" (
  "id" TEXT NOT NULL,
  "dispatchKey" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "campaignId" TEXT,
  "postId" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "occurrenceKey" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "status" "NotificationDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorLog" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriberNotificationDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotSubscriber_botId_platformUserId_key" ON "BotSubscriber"("botId", "platformUserId");
CREATE INDEX "BotSubscriber_botId_idx" ON "BotSubscriber"("botId");
CREATE INDEX "BotSubscriber_status_idx" ON "BotSubscriber"("status");
CREATE INDEX "BotSubscriber_lastInteractionAt_idx" ON "BotSubscriber"("lastInteractionAt");
CREATE INDEX "BotSubscriber_botId_status_id_idx" ON "BotSubscriber"("botId", "status", "id");
CREATE UNIQUE INDEX "NotificationTopic_botId_slug_key" ON "NotificationTopic"("botId", "slug");
CREATE UNIQUE INDEX "NotificationTopic_botId_callbackKey_key" ON "NotificationTopic"("botId", "callbackKey");
CREATE INDEX "NotificationTopic_botId_idx" ON "NotificationTopic"("botId");
CREATE INDEX "NotificationTopic_isActive_idx" ON "NotificationTopic"("isActive");
CREATE INDEX "NotificationTopic_botId_isActive_sortOrder_idx" ON "NotificationTopic"("botId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "SubscriberTopicSubscription_subscriberId_topicId_key" ON "SubscriberTopicSubscription"("subscriberId", "topicId");
CREATE INDEX "SubscriberTopicSubscription_topicId_idx" ON "SubscriberTopicSubscription"("topicId");
CREATE INDEX "SubscriberTopicSubscription_isEnabled_idx" ON "SubscriberTopicSubscription"("isEnabled");
CREATE INDEX "SubscriberTopicSubscription_topicId_isEnabled_subscriberId_idx" ON "SubscriberTopicSubscription"("topicId", "isEnabled", "subscriberId");
CREATE UNIQUE INDEX "PostNotificationTopic_postId_topicId_key" ON "PostNotificationTopic"("postId", "topicId");
CREATE INDEX "PostNotificationTopic_topicId_idx" ON "PostNotificationTopic"("topicId");
CREATE UNIQUE INDEX "SubscriberNotificationDispatch_dispatchKey_key" ON "SubscriberNotificationDispatch"("dispatchKey");
CREATE INDEX "SubscriberNotificationDispatch_botId_idx" ON "SubscriberNotificationDispatch"("botId");
CREATE INDEX "SubscriberNotificationDispatch_campaignId_idx" ON "SubscriberNotificationDispatch"("campaignId");
CREATE INDEX "SubscriberNotificationDispatch_postId_idx" ON "SubscriberNotificationDispatch"("postId");
CREATE INDEX "SubscriberNotificationDispatch_subscriberId_idx" ON "SubscriberNotificationDispatch"("subscriberId");
CREATE INDEX "SubscriberNotificationDispatch_status_idx" ON "SubscriberNotificationDispatch"("status");
CREATE INDEX "SubscriberNotificationDispatch_botId_status_id_idx" ON "SubscriberNotificationDispatch"("botId", "status", "id");

ALTER TABLE "BotSubscriber" ADD CONSTRAINT "BotSubscriber_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationTopic" ADD CONSTRAINT "NotificationTopic_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberTopicSubscription" ADD CONSTRAINT "SubscriberTopicSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "BotSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberTopicSubscription" ADD CONSTRAINT "SubscriberTopicSubscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "NotificationTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostNotificationTopic" ADD CONSTRAINT "PostNotificationTopic_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostNotificationTopic" ADD CONSTRAINT "PostNotificationTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "NotificationTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriberNotificationDispatch" ADD CONSTRAINT "SubscriberNotificationDispatch_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberNotificationDispatch" ADD CONSTRAINT "SubscriberNotificationDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriberNotificationDispatch" ADD CONSTRAINT "SubscriberNotificationDispatch_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberNotificationDispatch" ADD CONSTRAINT "SubscriberNotificationDispatch_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "BotSubscriber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
