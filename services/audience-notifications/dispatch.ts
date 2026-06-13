import { createHash, randomUUID } from "node:crypto";

import type { BotPlatform, NotificationDispatchStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import { subscriberNotificationConfig } from "./config";

type DispatchSummary = {
  matched: number;
  sent: number;
  failed: number;
  blocked: number;
  skipped: number;
};

type CampaignForDispatch = {
  id: string;
  botId: string;
  postId: string;
  notifySubscribers: boolean;
  subscriberAudienceKey: string | null;
  nextRun: Date;
  bot: {
    platform: BotPlatform;
    token: string;
    isActive: boolean;
  };
  post: {
    content: string | null;
    sourceChatId: string | null;
    sourceMessageId: number | null;
    notificationTopics: Array<{
      topic: { id: string; isActive: boolean };
    }>;
  };
};

export function createOccurrenceKey(input: {
  scheduledFor?: Date | null;
  operationId?: string;
}) {
  if (input.operationId) return `manual:${input.operationId}`;
  if (input.scheduledFor) return `scheduled:${input.scheduledFor.toISOString()}`;
  return `manual:${randomUUID()}`;
}

export function createDispatchKey(input: {
  audienceKey: string;
  occurrenceKey: string;
  postId: string;
  subscriberId: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.audienceKey,
        input.occurrenceKey,
        input.postId,
        input.subscriberId,
      ].join("|"),
    )
    .digest("hex");
}

export function sanitizeDispatchError(value: unknown) {
  const text = value instanceof Error ? value.message : String(value ?? "");
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "[bot-token]")
    .replace(/authorization:\s*\S+/gi, "authorization: [redacted]")
    .slice(0, 1000);
}

export async function dispatchCampaignSubscribers(input: {
  campaignId: string;
  occurrenceKey: string;
  scheduledFor?: Date | null;
}): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    matched: 0,
    sent: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
  };
  if (!subscriberNotificationConfig.enabled) return summary;

  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      botId: true,
      postId: true,
      notifySubscribers: true,
      subscriberAudienceKey: true,
      nextRun: true,
      bot: {
        select: {
          platform: true,
          token: true,
          isActive: true,
        },
      },
      post: {
        select: {
          content: true,
          sourceChatId: true,
          sourceMessageId: true,
          notificationTopics: {
            select: { topic: { select: { id: true, isActive: true } } },
          },
        },
      },
    },
  });

  if (!campaign?.notifySubscribers || !campaign.bot.isActive) return summary;
  const topicIds = campaign.post.notificationTopics
    .filter((item) => item.topic.isActive)
    .map((item) => item.topic.id);
  if (!topicIds.length) return { ...summary, skipped: 1 };

  const audienceKey =
    campaign.subscriberAudienceKey || `campaign:${campaign.id}`;
  let cursor: string | undefined;

  while (true) {
    const subscribers = await prisma.botSubscriber.findMany({
      where: {
        botId: campaign.botId,
        status: "ACTIVE",
        subscriptions: {
          some: {
            isEnabled: true,
            topicId: { in: topicIds },
            topic: { isActive: true, botId: campaign.botId },
          },
        },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: subscriberNotificationConfig.batchSize,
      select: { id: true, privateChatId: true },
    });
    if (!subscribers.length) break;
    summary.matched += subscribers.length;

    for (let index = 0; index < subscribers.length; index += subscriberNotificationConfig.concurrency) {
      const chunk = subscribers.slice(
        index,
        index + subscriberNotificationConfig.concurrency,
      );
      const results = await Promise.all(
        chunk.map((subscriber) =>
          processSubscriberDispatch({
            campaign,
            subscriber,
            audienceKey,
            occurrenceKey: input.occurrenceKey,
            scheduledFor: input.scheduledFor,
          }),
        ),
      );
      for (const status of results) {
        if (status === "SENT") summary.sent += 1;
        else if (status === "BLOCKED") summary.blocked += 1;
        else if (status === "SKIPPED") summary.skipped += 1;
        else if (status === "FAILED") summary.failed += 1;
      }
    }

    cursor = subscribers.at(-1)?.id;
    if (subscribers.length < subscriberNotificationConfig.batchSize) break;
  }

  return summary;
}

async function processSubscriberDispatch(input: {
  campaign: CampaignForDispatch;
  subscriber: { id: string; privateChatId: string };
  audienceKey: string;
  occurrenceKey: string;
  scheduledFor?: Date | null;
}): Promise<NotificationDispatchStatus> {
  const dispatchKey = createDispatchKey({
    audienceKey: input.audienceKey,
    occurrenceKey: input.occurrenceKey,
    postId: input.campaign.postId,
    subscriberId: input.subscriber.id,
  });

  const dispatch = await prisma.subscriberNotificationDispatch.upsert({
    where: { dispatchKey },
    create: {
      dispatchKey,
      botId: input.campaign.botId,
      campaignId: input.campaign.id,
      postId: input.campaign.postId,
      subscriberId: input.subscriber.id,
      occurrenceKey: input.occurrenceKey,
      scheduledFor: input.scheduledFor,
    },
    update: {},
  });

  if (dispatch.status === "SENT" || dispatch.status === "BLOCKED" || dispatch.status === "SKIPPED") {
    return "SKIPPED";
  }
  if (dispatch.attemptCount >= subscriberNotificationConfig.retryLimit) {
    return "FAILED";
  }

  const leaseThreshold = new Date(
    Date.now() - subscriberNotificationConfig.claimLeaseMs,
  );
  const claimed = await prisma.subscriberNotificationDispatch.updateMany({
    where: {
      id: dispatch.id,
      attemptCount: dispatch.attemptCount,
      OR: [
        { lastAttemptAt: dispatch.lastAttemptAt },
        { lastAttemptAt: { lt: leaseThreshold } },
      ],
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      status: "PENDING",
      errorLog: null,
    },
  });
  if (claimed.count !== 1) return "SKIPPED";

  const result = await getBotPlatformProvider(
    input.campaign.bot.platform,
  ).sendPrivatePost(
    input.campaign.bot.token,
    input.subscriber.privateChatId,
    input.campaign.post,
  );

  if (result.ok) {
    await prisma.subscriberNotificationDispatch.update({
      where: { id: dispatch.id },
      data: { status: "SENT", sentAt: new Date(), errorLog: null },
    });
    return "SENT";
  }

  const errorLog = sanitizeDispatchError(result.description);
  if (result.kind === "BLOCKED") {
    await prisma.$transaction([
      prisma.subscriberNotificationDispatch.update({
        where: { id: dispatch.id },
        data: { status: "BLOCKED", errorLog },
      }),
      prisma.botSubscriber.update({
        where: { id: input.subscriber.id },
        data: { status: "BLOCKED" },
      }),
    ]);
    return "BLOCKED";
  }

  await prisma.subscriberNotificationDispatch.update({
    where: { id: dispatch.id },
    data: {
      status: "FAILED",
      errorLog,
      ...(result.kind === "TERMINAL"
        ? { attemptCount: subscriberNotificationConfig.retryLimit }
        : {}),
    },
  });

  if (result.kind === "RATE_LIMITED" && result.retryAfterSeconds) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(result.retryAfterSeconds!, 30) * 1000),
    );
  }
  return "FAILED";
}
