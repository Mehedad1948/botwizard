"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { revalidatePath } from "next/cache";
import { getBotPlatformProviderBySlug } from "@/services/bot-platforms/provider";
import { calculateNextRunForSpecificTimes } from "@/lib/scheduling";
import {
  createOccurrenceKey,
  dispatchCampaignSubscribers,
} from "@/services/audience-notifications/dispatch";
import { createNotificationTopic } from "@/services/audience-notifications/topics";

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

function getCampaignMessagePayload(campaign: {
  chatId: string;
  post: {
    content: string | null;
    sourceChatId: string | null;
    sourceMessageId: number | null;
  };
}) {
  const method =
    campaign.post.sourceChatId && campaign.post.sourceMessageId
      ? "copyMessage"
      : "sendMessage";

  const payload =
    method === "copyMessage"
      ? {
          chat_id: campaign.chatId,
          from_chat_id: campaign.post.sourceChatId!,
          message_id: campaign.post.sourceMessageId!,
        }
      : {
          chat_id: campaign.chatId,
          text: campaign.post.content || "محتوای بدون متن",
        };

  return { method, payload };
}

export async function toggleCampaignAction(
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
    select: { id: true, botId: true, isActive: true },
  });
  if (!campaign) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { isActive: !campaign.isActive },
  });

  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

export async function deleteCampaignAction(
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
    select: { id: true, botId: true },
  });
  if (!campaign) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };

  await prisma.campaign.delete({ where: { id: campaign.id } });
  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

export async function updateCampaignScheduleAction(
  platform: PlatformSlug,
  campaignId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const scheduleType =
    String(formData.get("scheduleType")) === "SPECIFIC_TIMES"
      ? "SPECIFIC_TIMES"
      : "INTERVAL";
  const intervalHours = Number(formData.get("intervalHours"));
  const specificTimes = String(formData.get("specificTimes") ?? "")
    .split(",")
    .map((time) => time.trim())
    .filter(Boolean);
  const validTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (
    scheduleType === "INTERVAL" &&
    (!Number.isInteger(intervalHours) || intervalHours < 2)
  ) {
    return { error: "فاصله زمانی باید یک عدد صحیح و حداقل ۲ ساعت باشد." };
  }

  if (
    scheduleType === "SPECIFIC_TIMES" &&
    (specificTimes.length === 0 ||
      specificTimes.some((time) => !validTimePattern.test(time)))
  ) {
    return {
      error: "ساعت‌ها را با فرمت HH:MM و جداشده با کاما وارد کنید.",
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    },
    select: { id: true, botId: true },
  });

  if (!campaign) {
    return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  }

  const normalizedTimes = [...new Set(specificTimes)].sort();
  const nextRun =
    scheduleType === "SPECIFIC_TIMES"
      ? calculateNextRunForSpecificTimes(normalizedTimes)
      : new Date(Date.now() + intervalHours * 60 * 60 * 1000);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      scheduleType,
      intervalHours: scheduleType === "INTERVAL" ? intervalHours : null,
      specificTimes:
        scheduleType === "SPECIFIC_TIMES" ? normalizedTimes : [],
      nextRun,
    },
  });

  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}

export async function sendCampaignNowAction(
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
    include: {
      bot: {
        select: {
          id: true,
          token: true,
          isActive: true,
          platform: true,
        },
      },
      post: {
        select: {
          content: true,
          sourceChatId: true,
          sourceMessageId: true,
        },
      },
    },
  });

  if (!campaign) {
    return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  }

  if (!campaign.bot.isActive) {
    return { error: "برای ارسال دستی، ابتدا ربات را فعال کنید." };
  }

  const { method, payload } = getCampaignMessagePayload(campaign);
  const provider = getBotPlatformProviderBySlug(platform);

  try {
    const result = await provider.call(campaign.bot.token, method, payload);

    await prisma.postHistory.create({
      data: {
        campaignId: campaign.id,
        status: result.ok ? "SUCCESS" : "FAILED",
        errorLog: result.ok ? null : result.description || "ارسال ناموفق بود.",
      },
    });

    revalidateCampaignPages(platform, campaign.id, campaign.bot.id);

    if (!result.ok) {
      return {
        error:
          result.description ||
          `ارسال دستی در ${provider.slug === "telegram" ? "تلگرام" : "بله"} انجام نشد.`,
      };
    }

    let subscriberSummary = null;
    try {
      subscriberSummary = await dispatchCampaignSubscribers({
        campaignId: campaign.id,
        occurrenceKey: createOccurrenceKey({ operationId: randomUUID() }),
      });
    } catch (error) {
      console.error("[Subscriber notification phase failed]", error);
    }

    return { success: true, subscriberSummary };
  } catch {
    await prisma.postHistory.create({
      data: {
        campaignId: campaign.id,
        status: "FAILED",
        errorLog: "ارتباط با پیام‌رسان برقرار نشد.",
      },
    });

    revalidateCampaignPages(platform, campaign.id, campaign.bot.id);
    return { error: "ارتباط با پیام‌رسان برقرار نشد. دوباره تلاش کنید." };
  }
}

export async function sendCampaignPreviewToOwnerAction(
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
    include: {
      bot: {
        select: {
          id: true,
          token: true,
          isActive: true,
          ownerPlatformUserId: true,
        },
      },
      post: {
        select: {
          content: true,
          sourceChatId: true,
          sourceMessageId: true,
        },
      },
    },
  });

  if (!campaign) {
    return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };
  }

  if (!campaign.bot.isActive) {
    return { error: "برای مشاهده پیام، ابتدا ربات را فعال کنید." };
  }

  if (!campaign.bot.ownerPlatformUserId) {
    return { error: "شناسه مالک ربات برای ارسال پیش‌نمایش در دسترس نیست." };
  }

  const previewTarget = campaign.bot.ownerPlatformUserId;
  const method =
    campaign.post.sourceChatId && campaign.post.sourceMessageId
      ? "copyMessage"
      : "sendMessage";
  const payload =
    method === "copyMessage"
      ? {
          chat_id: previewTarget,
          from_chat_id: campaign.post.sourceChatId!,
          message_id: campaign.post.sourceMessageId!,
        }
      : {
          chat_id: previewTarget,
          text: campaign.post.content || "محتوای بدون متن",
        };

  try {
    const result = await getBotPlatformProviderBySlug(platform).call(
      campaign.bot.token,
      method,
      payload,
    );

    if (!result.ok) {
      return {
        error:
          result.description || "ارسال پیش‌نمایش به گفت‌وگوی خصوصی ربات انجام نشد.",
      };
    }

    return { success: true };
  } catch {
    return {
      error: "ارسال پیش‌نمایش به گفت‌وگوی خصوصی ربات انجام نشد. دوباره تلاش کنید.",
    };
  }
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
      postId: true,
      scheduleType: true,
      nextRun: true,
      notifySubscribers: true,
      subscriberAudienceKey: true,
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
    data: {
      notifySubscribers,
      subscriberAudienceKey:
        campaign.subscriberAudienceKey ||
        `post:${campaign.postId}:${campaign.scheduleType}:${campaign.nextRun.toISOString()}`,
    },
  });
  revalidateCampaignPages(platform, campaign.id, campaign.botId);
  return { success: true };
}
