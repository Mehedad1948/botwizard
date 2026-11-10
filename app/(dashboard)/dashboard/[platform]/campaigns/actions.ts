"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { revalidatePath } from "next/cache";
import { createNotificationTopic } from "@/services/audience-notifications/topics";
import {
  createCampaign,
  deleteCampaign,
  publishNow,
  runCampaignNow,
  setCampaignPaused,
  summarizeSend,
  updateCampaign,
  type CampaignInput,
} from "@/services/publishing/campaigns";
import { DEFAULT_TIME_ZONE, zonedToUtc } from "@/services/publishing/schedule";
import {
  findActionBot,
  findActionCampaignBot,
} from "@/services/dashboard/access";

function revalidateCampaignPages(
  platform: PlatformSlug,
  campaignId: string,
  botId: string,
) {
  revalidatePath(dashboardPath(platform));
  revalidatePath(dashboardPath(platform, "campaigns"));
  revalidatePath(dashboardPath(platform, `campaigns/${campaignId}`));
  revalidatePath(dashboardPath(platform, `bots/${botId}`));
  revalidatePath(dashboardPath(platform, `bots/${botId}/notifications`));
}

async function findOwnedCampaign(
  platform: PlatformSlug,
  campaignId: string,
  userId: string,
) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: {
        userId,
        platform: platformFromSlug(platform),
      },
    },
    select: {
      id: true,
      botId: true,
      postId: true,
    },
  });
}

export async function createCampaignTopicAction(
  platform: PlatformSlug,
  campaignId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await findOwnedCampaign(platform, campaignId, session.userId);
  if (!campaign) {
    return { error: "کمپین پیدا نشد یا به آن دسترسی ندارید." };
  }

  try {
    const topic = await createNotificationTopic({
      userId: session.userId,
      botId: campaign.botId,
      platform: platformFromSlug(platform),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    if (!topic) return { error: "نام موضوع معتبر نیست." };

    await prisma.postNotificationTopic.upsert({
      where: {
        postId_topicId: {
          postId: campaign.postId,
          topicId: topic.id,
        },
      },
      create: {
        postId: campaign.postId,
        topicId: topic.id,
      },
      update: {},
    });

    revalidateCampaignPages(platform, campaign.id, campaign.botId);
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "موضوعی با این نام از قبل برای ربات وجود دارد." };
    }
    return { error: "ایجاد موضوع انجام نشد." };
  }
}

export async function addCampaignTopicAction(
  platform: PlatformSlug,
  campaignId: string,
  topicId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await findOwnedCampaign(platform, campaignId, session.userId);
  if (!campaign) {
    return { error: "کمپین پیدا نشد یا به آن دسترسی ندارید." };
  }

  const topic = await prisma.notificationTopic.findFirst({
    where: {
      id: topicId,
      botId: campaign.botId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!topic) {
    return { error: "موضوع فعال پیدا نشد یا متعلق به این ربات نیست." };
  }

  await prisma.postNotificationTopic.upsert({
    where: {
      postId_topicId: {
        postId: campaign.postId,
        topicId: topic.id,
      },
    },
    create: {
      postId: campaign.postId,
      topicId: topic.id,
    },
    update: {},
  });

  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

export async function removeCampaignTopicAction(
  platform: PlatformSlug,
  campaignId: string,
  topicId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await findOwnedCampaign(platform, campaignId, session.userId);
  if (!campaign) {
    return { error: "کمپین پیدا نشد یا به آن دسترسی ندارید." };
  }

  const topic = await prisma.notificationTopic.findFirst({
    where: {
      id: topicId,
      botId: campaign.botId,
    },
    select: { id: true },
  });
  if (!topic) {
    return { error: "موضوع پیدا نشد یا متعلق به این ربات نیست." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.postNotificationTopic.deleteMany({
      where: {
        postId: campaign.postId,
        topicId: topic.id,
      },
    });

    const remainingTopics = await tx.postNotificationTopic.count({
      where: {
        postId: campaign.postId,
        topic: { isActive: true },
      },
    });

    if (remainingTopics === 0) {
      await tx.campaign.updateMany({
        where: {
          postId: campaign.postId,
          botId: campaign.botId,
        },
        data: { notifySubscribers: false },
      });
    }
  });

  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

export async function toggleCampaignSubscriberNotificationsAction(
  platform: PlatformSlug,
  campaignId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    },
    select: {
      id: true,
      botId: true,
      notifySubscribers: true,
      post: {
        select: {
          notificationTopics: {
            where: { topic: { isActive: true } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!campaign) return { error: "کمپین پیدا نشد یا دسترسی ندارید." };

  const notifySubscribers = !campaign.notifySubscribers;
  if (notifySubscribers && campaign.post.notificationTopics.length === 0) {
    return {
      error: "برای فعال‌سازی اعلان مشترک‌ها ابتدا یک موضوع فعال به پست اختصاص دهید.",
    };
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { notifySubscribers },
  });
  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

// ------------------------------------------------------------------ campaigns

function readCampaignForm(formData: FormData): CampaignInput | { error: string } {
  const kind = String(formData.get("scheduleKind") ?? "");
  if (!["ONCE", "INTERVAL", "DAILY", "WEEKLY"].includes(kind)) {
    return { error: "نوع زمان‌بندی را انتخاب کنید." };
  }
  const timezone = DEFAULT_TIME_ZONE;
  const optionalNumber = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value ? Number(value) : null;
  };
  const intervalValue = optionalNumber("intervalValue");
  const intervalUnit = String(formData.get("intervalUnit") ?? "hours");

  return {
    postId: String(formData.get("postId") ?? ""),
    destinationIds: formData.getAll("destinationIds").map(String),
    name: String(formData.get("name") ?? ""),
    notifySubscribers: formData.get("notifySubscribers") === "on",
    scheduleKind: kind as CampaignInput["scheduleKind"],
    intervalMinutes:
      intervalValue === null
        ? null
        : Math.round(intervalValue * (intervalUnit === "days" ? 1440 : 60)),
    times: formData.getAll("times").map(String).filter(Boolean),
    weekdays: formData.getAll("weekdays").map(Number),
    timezone,
    startsAt: parseLocalDateTime(String(formData.get("startsAt") ?? ""), timezone),
    endsAt: parseLocalDateTime(String(formData.get("endsAt") ?? ""), timezone),
    maxRuns: optionalNumber("maxRuns"),
    jitterMinutes: optionalNumber("jitterMinutes") ?? 0,
  };
}

/** Parses an <input type="datetime-local"> value as wall-clock time in `timezone`. */
function parseLocalDateTime(value: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return zonedToUtc(year, month, day, hour, minute, timezone);
}

export async function saveCampaignAction(
  platform: PlatformSlug,
  botId: string,
  campaignId: string | null,
  formData: FormData,
): Promise<{ success?: boolean; error?: string; campaignId?: string }> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات پیدا نشد یا به آن دسترسی ندارید." };

  const input = readCampaignForm(formData);
  if ("error" in input) return { error: input.error };

  const result = campaignId
    ? await updateCampaign(bot.id, campaignId, input)
    : await createCampaign(bot.id, input);
  if (!result.ok) return { error: result.error };

  revalidateCampaignPages(platform, result.value.id, bot.id);
  return { success: true, campaignId: result.value.id };
}

export async function publishNowAction(
  platform: PlatformSlug,
  botId: string,
  formData: FormData,
): Promise<{ success?: boolean; error?: string; campaignId?: string; message?: string }> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات پیدا نشد یا به آن دسترسی ندارید." };
  if (!bot.isActive) return { error: "ربات غیرفعال است؛ ابتدا آن را فعال کنید." };

  const result = await publishNow(bot.id, {
    postId: String(formData.get("postId") ?? ""),
    destinationIds: formData.getAll("destinationIds").map(String),
    name: String(formData.get("name") ?? ""),
    notifySubscribers: formData.get("notifySubscribers") === "on",
  });
  if (!result.ok) return { error: result.error };

  revalidateCampaignPages(platform, result.value.id, bot.id);
  return {
    success: true,
    campaignId: result.value.id,
    message: summarizeSend(result.value.summary),
  };
}

export async function setCampaignPausedAction(
  platform: PlatformSlug,
  campaignId: string,
  paused: boolean,
) {
  const botId = await findActionCampaignBot(platform, campaignId);
  if (!botId) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  const result = await setCampaignPaused(botId, campaignId, paused);
  if (!result.ok) return { error: result.error };
  revalidateCampaignPages(platform, campaignId, botId);
  return { success: true };
}

export async function deleteCampaignAction(platform: PlatformSlug, campaignId: string) {
  const botId = await findActionCampaignBot(platform, campaignId);
  if (!botId) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  await deleteCampaign(botId, campaignId);
  revalidateCampaignPages(platform, campaignId, botId);
  return { success: true };
}

export async function runCampaignNowAction(platform: PlatformSlug, campaignId: string) {
  const botId = await findActionCampaignBot(platform, campaignId);
  if (!botId) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  const result = await runCampaignNow(botId, campaignId);
  revalidateCampaignPages(platform, campaignId, botId);
  if (!result.ok) return { error: result.error };
  if (!result.value.sent && result.value.failed) {
    return { error: `ارسال انجام نشد: ${summarizeSend(result.value)}. جزئیات در تاریخچه ارسال‌ها.` };
  }
  return { success: true };
}
