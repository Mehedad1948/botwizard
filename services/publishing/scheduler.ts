import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import {
  createOccurrenceKey,
  dispatchCampaignSubscribers,
} from "@/services/audience-notifications/dispatch";
import { sendPost } from "./content";
import { RETRYABLE_KINDS, retryDelayMilliseconds } from "./errors";
import { jitterMilliseconds, nextOccurrence } from "./schedule";

export const MAX_DELIVERY_ATTEMPTS = 5;
const DELIVERY_LEASE_MS = 5 * 60_000;
const SEND_GAP_MS = 60;
const BOT_CONCURRENCY = 4;

export type TickSummary = {
  occurrences: number;
  sent: number;
  failed: number;
  retried: number;
  subscriberDispatches: number;
  durationMs: number;
};

type Occurrence = {
  campaignId: string;
  occurrenceKey: string;
  scheduledFor: Date;
  notifySubscribers: boolean;
};

/**
 * Turns due campaigns into per-destination delivery rows and advances their
 * schedule. Missed occurrences collapse into a single catch-up run.
 */
export async function materializeDueOccurrences(
  now = new Date(),
  limit = 25,
): Promise<Occurrence[]> {
  return prisma.$transaction(
    async (tx) => {
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Campaign"
        WHERE status = 'ACTIVE' AND "nextRun" IS NOT NULL AND "nextRun" <= ${now}
        ORDER BY "nextRun" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      if (!due.length) return [];

      const campaigns = await tx.campaign.findMany({
        where: { id: { in: due.map((row) => row.id) } },
        include: {
          bot: { select: { isActive: true } },
          targets: { include: { destination: true } },
        },
      });

      const occurrences: Occurrence[] = [];
      for (const campaign of campaigns) {
        const scheduledFor = campaign.nextRun!;
        const occurrenceKey = createOccurrenceKey({ scheduledFor });

        if (campaign.targets.length) {
          await tx.delivery.createMany({
            skipDuplicates: true,
            data: campaign.targets.map(({ destination }) => {
              const skipKind = !campaign.bot.isActive
                ? "BOT_INACTIVE"
                : destination.status !== "ACTIVE"
                  ? "DESTINATION_INACTIVE"
                  : null;
              return {
                botId: campaign.botId,
                campaignId: campaign.id,
                destinationId: destination.id,
                chatId: destination.chatId,
                chatTitle: destination.chatTitle,
                occurrenceKey,
                trigger: "SCHEDULED" as const,
                status: skipKind ? ("SKIPPED" as const) : ("PENDING" as const),
                errorKind: skipKind,
                runAt: new Date(
                  scheduledFor.getTime() +
                    jitterMilliseconds(campaign.jitterMinutes),
                ),
              };
            }),
          });
        }

        const runCount = campaign.runCount + 1;
        const after = new Date(Math.max(now.getTime(), scheduledFor.getTime()));
        const nextRun = nextOccurrence({ ...campaign, runCount }, after);

        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            runCount,
            lastRunAt: scheduledFor,
            nextRun,
            ...(nextRun ? {} : { status: "COMPLETED" as const }),
          },
        });

        occurrences.push({
          campaignId: campaign.id,
          occurrenceKey,
          scheduledFor,
          notifySubscribers: campaign.notifySubscribers && campaign.bot.isActive,
        });
      }

      return occurrences;
    },
    { timeout: 20_000 },
  );
}

async function claimDeliveries(input: {
  now: Date;
  limit: number;
  ids?: string[];
}): Promise<string[]> {
  const leaseCutoff = new Date(input.now.getTime() - DELIVERY_LEASE_MS);
  const idFilter = input.ids?.length
    ? Prisma.sql`AND id = ANY(${input.ids})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Delivery"
    SET status = 'SENDING', "lockedAt" = ${input.now}, attempts = attempts + 1, "updatedAt" = ${input.now}
    WHERE id IN (
      SELECT id FROM "Delivery"
      WHERE (
        (status = 'PENDING' AND "runAt" <= ${input.now})
        OR (status = 'SENDING' AND "lockedAt" < ${leaseCutoff})
      ) ${idFilter}
      ORDER BY "runAt" ASC
      LIMIT ${input.limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;

  return rows.map((row) => row.id);
}

type DeliveryOutcome = "SENT" | "FAILED" | "RETRY";

async function processDelivery(id: string): Promise<DeliveryOutcome> {
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      bot: { select: { token: true, platform: true, isActive: true } },
      campaign: {
        select: {
          post: {
            select: {
              content: true,
              entities: true,
              mediaType: true,
              mediaFileId: true,
              buttons: true,
              sourceChatId: true,
              sourceMessageId: true,
            },
          },
        },
      },
    },
  });
  if (!delivery || delivery.status !== "SENDING") return "FAILED";

  if (!delivery.bot.isActive) {
    await prisma.delivery.update({
      where: { id },
      data: { status: "SKIPPED", errorKind: "BOT_INACTIVE", lockedAt: null },
    });
    return "FAILED";
  }

  const result = await sendPost(
    getBotPlatformProvider(delivery.bot.platform),
    delivery.bot.token,
    delivery.chatId,
    delivery.campaign.post,
  );

  if (result.ok) {
    await prisma.delivery.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: result.providerMessageId,
        errorKind: null,
        errorMessage: null,
        lockedAt: null,
      },
    });
    return "SENT";
  }

  const { error } = result;
  const retry =
    RETRYABLE_KINDS.has(error.kind) && delivery.attempts < MAX_DELIVERY_ATTEMPTS;

  await prisma.delivery.update({
    where: { id },
    data: {
      status: retry ? "PENDING" : "FAILED",
      errorKind: error.kind,
      errorMessage: error.detail,
      lockedAt: null,
      ...(retry
        ? {
            runAt: new Date(
              Date.now() +
                retryDelayMilliseconds(delivery.attempts, error.retryAfterSeconds),
            ),
          }
        : {}),
    },
  });

  if (
    delivery.destinationId &&
    (error.kind === "NO_PERMISSION" || error.kind === "REMOVED")
  ) {
    await prisma.connectedChat.updateMany({
      where: { id: delivery.destinationId },
      data: {
        status: error.kind,
        statusReason: error.detail,
        lastCheckedAt: new Date(),
      },
    });
  }

  return retry ? "RETRY" : "FAILED";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends claimed deliveries: bots in parallel, each bot's sends sequential. */
async function sendClaimed(ids: string[]) {
  const rows = await prisma.delivery.findMany({
    where: { id: { in: ids } },
    select: { id: true, botId: true },
  });
  const byBot = new Map<string, string[]>();
  for (const row of rows) {
    byBot.set(row.botId, [...(byBot.get(row.botId) ?? []), row.id]);
  }

  const outcomes: DeliveryOutcome[] = [];
  const queues = [...byBot.values()];
  const workers = Array.from(
    { length: Math.min(BOT_CONCURRENCY, queues.length) },
    async () => {
      for (let queue = queues.shift(); queue; queue = queues.shift()) {
        for (const id of queue) {
          outcomes.push(await processDelivery(id));
          await sleep(SEND_GAP_MS);
        }
      }
    },
  );
  await Promise.all(workers);
  return outcomes;
}

async function notifySubscribers(occurrences: Occurrence[]) {
  let count = 0;
  for (const occurrence of occurrences) {
    if (!occurrence.notifySubscribers) continue;
    try {
      await dispatchCampaignSubscribers({
        campaignId: occurrence.campaignId,
        occurrenceKey: occurrence.occurrenceKey,
        scheduledFor: occurrence.scheduledFor,
      });
      count += 1;
    } catch (error) {
      console.error("[scheduler] subscriber dispatch failed", error);
    }
  }
  return count;
}

/** One scheduler pass, bounded by `budgetMs`. Safe to run concurrently. */
export async function runSchedulerTick(budgetMs = 45_000): Promise<TickSummary> {
  const started = Date.now();
  const summary: TickSummary = {
    occurrences: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    subscriberDispatches: 0,
    durationMs: 0,
  };
  const hasTime = () => Date.now() - started < budgetMs;

  while (hasTime()) {
    const occurrences = await materializeDueOccurrences(new Date());
    if (!occurrences.length) break;
    summary.occurrences += occurrences.length;
    summary.subscriberDispatches += await notifySubscribers(occurrences);
  }

  while (hasTime()) {
    const ids = await claimDeliveries({ now: new Date(), limit: 50 });
    if (!ids.length) break;
    for (const outcome of await sendClaimed(ids)) {
      if (outcome === "SENT") summary.sent += 1;
      else if (outcome === "RETRY") summary.retried += 1;
      else summary.failed += 1;
    }
  }

  summary.durationMs = Date.now() - started;
  return summary;
}

export type ManualSendSummary = {
  sent: number;
  failed: number;
  skipped: number;
  pendingRetry: number;
};

/** Sends a campaign immediately to its active destinations. */
export async function sendCampaignNow(campaignId: string): Promise<ManualSendSummary> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { targets: { include: { destination: true } } },
  });
  const occurrenceKey = createOccurrenceKey({ operationId: randomUUID() });
  const active = campaign.targets.filter(
    ({ destination }) => destination.status === "ACTIVE",
  );

  if (active.length) {
    await prisma.delivery.createMany({
      data: active.map(({ destination }) => ({
        botId: campaign.botId,
        campaignId: campaign.id,
        destinationId: destination.id,
        chatId: destination.chatId,
        chatTitle: destination.chatTitle,
        occurrenceKey,
        trigger: "MANUAL" as const,
      })),
    });
  }

  const created = await prisma.delivery.findMany({
    where: { campaignId, occurrenceKey },
    select: { id: true },
  });
  const ids = await claimDeliveries({
    now: new Date(),
    limit: created.length || 1,
    ids: created.map((row) => row.id),
  });
  const outcomes = ids.length ? await sendClaimed(ids) : [];

  if (campaign.notifySubscribers) {
    await notifySubscribers([
      {
        campaignId,
        occurrenceKey,
        scheduledFor: new Date(),
        notifySubscribers: true,
      },
    ]);
  }

  return {
    sent: outcomes.filter((outcome) => outcome === "SENT").length,
    failed: outcomes.filter((outcome) => outcome === "FAILED").length,
    pendingRetry: outcomes.filter((outcome) => outcome === "RETRY").length,
    skipped: campaign.targets.length - active.length,
  };
}
