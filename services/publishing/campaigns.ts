import type { Prisma, ScheduleKind } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  DEFAULT_TIME_ZONE,
  firstOccurrence,
  normalizeTimes,
  validateSchedule,
  type ScheduleInput,
} from "./schedule";
import { sendCampaignNow, type ManualSendSummary } from "./scheduler";

/**
 * Campaign operations. Every function takes the bot id the caller has already
 * authorised and filters by it, so a campaign, post or destination of another
 * bot can never be read or changed through these functions.
 */

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

export type ScheduleFields = {
  scheduleKind: ScheduleKind;
  intervalMinutes?: number | null;
  times?: string[];
  weekdays?: number[];
  timezone?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRuns?: number | null;
  jitterMinutes?: number;
};

export type CampaignInput = ScheduleFields & {
  postId: string;
  destinationIds: string[];
  name?: string | null;
  notifySubscribers?: boolean;
};

function buildSchedule(fields: ScheduleFields, now: Date, runCount = 0) {
  const kind = fields.scheduleKind;
  const startsAt =
    fields.startsAt && fields.startsAt > now ? fields.startsAt : now;
  const schedule: ScheduleInput & { jitterMinutes: number } = {
    scheduleKind: kind,
    intervalMinutes: kind === "INTERVAL" ? (fields.intervalMinutes ?? null) : null,
    times:
      kind === "DAILY" || kind === "WEEKLY"
        ? (fields.times ?? []).map((time) => time.trim()).filter(Boolean)
        : [],
    weekdays: kind === "WEEKLY" ? [...new Set(fields.weekdays ?? [])].sort() : [],
    timezone: fields.timezone || DEFAULT_TIME_ZONE,
    startsAt,
    endsAt: kind === "ONCE" ? null : (fields.endsAt ?? null),
    maxRuns: kind === "ONCE" ? null : (fields.maxRuns ?? null),
    runCount,
    jitterMinutes: fields.jitterMinutes ?? 0,
  };

  const error = validateSchedule(schedule);
  if (error) return { ok: false as const, ...error, error: error.message };

  schedule.times = normalizeTimes(schedule.times);
  const nextRun = firstOccurrence(schedule, now);
  if (!nextRun) {
    return {
      ok: false as const,
      field: "endsAt",
      error: "با این تنظیمات هیچ زمان اجرایی در آینده وجود ندارد.",
    };
  }

  const { runCount: _ignored, ...data } = schedule;
  void _ignored;
  return { ok: true as const, data, nextRun };
}

async function validateTargets(
  tx: Prisma.TransactionClient,
  botId: string,
  postId: string,
  destinationIds: string[],
): Promise<string | null> {
  const post = await tx.post.findFirst({
    where: { id: postId, botId, archivedAt: null },
    select: { id: true },
  });
  if (!post) return "پست انتخاب‌شده پیدا نشد.";

  const unique = [...new Set(destinationIds)];
  if (!unique.length) return "حداقل یک مقصد را انتخاب کنید.";

  const destinations = await tx.connectedChat.findMany({
    where: { id: { in: unique }, botId },
    select: { id: true, status: true },
  });
  if (destinations.length !== unique.length) {
    return "یکی از مقصدهای انتخاب‌شده متعلق به این ربات نیست.";
  }
  if (destinations.some((destination) => destination.status === "REMOVED")) {
    return "ربات از یکی از مقصدهای انتخاب‌شده حذف شده است.";
  }
  return null;
}

export async function createCampaign(
  botId: string,
  input: CampaignInput,
  now = new Date(),
): Promise<Result<{ id: string }>> {
  const schedule = buildSchedule(input, now);
  if (!schedule.ok) return schedule;

  return prisma.$transaction(async (tx) => {
    const targetError = await validateTargets(
      tx,
      botId,
      input.postId,
      input.destinationIds,
    );
    if (targetError) return { ok: false, error: targetError };

    const campaign = await tx.campaign.create({
      data: {
        botId,
        postId: input.postId,
        name: input.name?.trim() || null,
        notifySubscribers: input.notifySubscribers ?? false,
        ...schedule.data,
        nextRun: schedule.nextRun,
        targets: {
          create: [...new Set(input.destinationIds)].map((destinationId) => ({
            destinationId,
          })),
        },
      },
      select: { id: true },
    });
    return { ok: true, value: campaign };
  });
}

/** Creates a completed one-off campaign and sends it immediately. */
export async function publishNow(
  botId: string,
  input: Omit<CampaignInput, keyof ScheduleFields>,
  now = new Date(),
): Promise<Result<{ id: string; summary: ManualSendSummary }>> {
  const created = await prisma.$transaction(async (tx) => {
    const targetError = await validateTargets(
      tx,
      botId,
      input.postId,
      input.destinationIds,
    );
    if (targetError) return { ok: false as const, error: targetError };

    const campaign = await tx.campaign.create({
      data: {
        botId,
        postId: input.postId,
        name: input.name?.trim() || null,
        notifySubscribers: input.notifySubscribers ?? false,
        scheduleKind: "ONCE",
        startsAt: now,
        status: "COMPLETED",
        runCount: 1,
        lastRunAt: now,
        nextRun: null,
        times: [],
        weekdays: [],
        targets: {
          create: [...new Set(input.destinationIds)].map((destinationId) => ({
            destinationId,
          })),
        },
      },
      select: { id: true },
    });
    return { ok: true as const, id: campaign.id };
  });
  if (!created.ok) return created;

  const summary = await sendCampaignNow(created.id);
  return { ok: true, value: { id: created.id, summary } };
}

export async function updateCampaign(
  botId: string,
  campaignId: string,
  input: CampaignInput,
  now = new Date(),
): Promise<Result<{ id: string }>> {
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, botId },
    select: { id: true, status: true, runCount: true },
  });
  if (!existing) return { ok: false, error: "کمپین پیدا نشد." };

  // Editing the schedule starts a fresh run counter for maxRuns.
  const schedule = buildSchedule(input, now);
  if (!schedule.ok) return schedule;

  return prisma.$transaction(async (tx) => {
    const targetError = await validateTargets(
      tx,
      botId,
      input.postId,
      input.destinationIds,
    );
    if (targetError) return { ok: false, error: targetError };

    await tx.campaignTarget.deleteMany({ where: { campaignId } });
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        postId: input.postId,
        name: input.name?.trim() || null,
        notifySubscribers: input.notifySubscribers ?? false,
        ...schedule.data,
        runCount: 0,
        nextRun: existing.status === "PAUSED" ? schedule.nextRun : schedule.nextRun,
        status: existing.status === "PAUSED" ? "PAUSED" : "ACTIVE",
        targets: {
          create: [...new Set(input.destinationIds)].map((destinationId) => ({
            destinationId,
          })),
        },
      },
    });
    return { ok: true, value: { id: campaignId } };
  });
}

export async function setCampaignPaused(
  botId: string,
  campaignId: string,
  paused: boolean,
  now = new Date(),
): Promise<Result<{ status: string }>> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, botId },
  });
  if (!campaign) return { ok: false, error: "کمپین پیدا نشد." };
  if (campaign.status === "COMPLETED") {
    return { ok: false, error: "این کمپین پایان یافته است؛ برای اجرای دوباره آن را ویرایش کنید." };
  }

  if (paused) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    });
    return { ok: true, value: { status: "PAUSED" } };
  }

  // Resuming never replays runs missed while paused.
  const nextRun = firstOccurrence(campaign, now);
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: nextRun
      ? { status: "ACTIVE", nextRun }
      : { status: "COMPLETED", nextRun: null },
  });
  return { ok: true, value: { status: nextRun ? "ACTIVE" : "COMPLETED" } };
}

export async function deleteCampaign(botId: string, campaignId: string) {
  const result = await prisma.campaign.deleteMany({
    where: { id: campaignId, botId },
  });
  return result.count === 1;
}

export async function runCampaignNow(
  botId: string,
  campaignId: string,
): Promise<Result<ManualSendSummary>> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, botId },
    select: { id: true, bot: { select: { isActive: true } } },
  });
  if (!campaign) return { ok: false, error: "کمپین پیدا نشد." };
  if (!campaign.bot.isActive) {
    return { ok: false, error: "ربات غیرفعال است؛ ابتدا آن را فعال کنید." };
  }
  return { ok: true, value: await sendCampaignNow(campaign.id) };
}

export function summarizeSend(summary: ManualSendSummary) {
  const parts = [`${summary.sent.toLocaleString("fa-IR")} ارسال موفق`];
  if (summary.failed) parts.push(`${summary.failed.toLocaleString("fa-IR")} ناموفق`);
  if (summary.pendingRetry) {
    parts.push(`${summary.pendingRetry.toLocaleString("fa-IR")} در صف تلاش مجدد`);
  }
  if (summary.skipped) {
    parts.push(`${summary.skipped.toLocaleString("fa-IR")} مقصد غیرفعال رد شد`);
  }
  return parts.join("، ");
}
