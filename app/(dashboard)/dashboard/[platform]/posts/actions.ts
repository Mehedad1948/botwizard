/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import prisma from "@/lib/prisma";
import { calculateNextRunForSpecificTimes } from "@/lib/scheduling";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { getBotPlatformProviderBySlug } from "@/services/bot-platforms/provider";

export async function createPostAction(
  platform: PlatformSlug,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error("عدم دسترسی. لطفا وارد شوید.");
  }

  const botId = formData.get("botId") as string;
  const content = formData.get("content") as string;
  const mediaType = formData.get("mediaType") as any; 
  const mediaUrl = formData.get("mediaUrl") as string | null;

  if (!botId) {
    throw new Error("انتخاب ربات الزامی است.");
  }

  try {
    // تایید اینکه این ربات متعلق به همین کاربر است (جلوگیری از دسترسی غیرمجاز)
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    });

    if (!bot) {
      throw new Error("ربات یافت نشد یا دسترسی ندارید.");
    }

    await prisma.post.create({
      data: {
        botId,
        content: content || null,
        mediaType: mediaType || "NONE",
        mediaUrl: mediaUrl || null,
      },
    });

    revalidatePath(dashboardPath(platform, "campaigns"));
  } catch {
    throw new Error("خطایی در ایجاد پست رخ داد.");
  }
}

export async function deletePostAction(
  platform: PlatformSlug,
  postId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    },
    select: { id: true, botId: true },
  });

  if (!post) return { error: "پست یافت نشد یا به آن دسترسی ندارید." };

  await prisma.post.delete({ where: { id: post.id } });

  revalidatePath(dashboardPath(platform, "campaigns"));
  revalidatePath(dashboardPath(platform, `bots/${post.botId}`));
  revalidatePath(dashboardPath(platform));
  return { success: true };
}

export async function createCampaignFromDashboardAction(
  platform: PlatformSlug,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const postId = formData.get("postId") as string;
  const connectedChatId = formData.get("connectedChatId") as string;
  const scheduleType = String(formData.get("scheduleType") ?? "INTERVAL");
  const intervalHours = Number(formData.get("intervalHours"));
  const specificTimes = String(formData.get("specificTimes") ?? "")
    .split(",")
    .map((time) => time.trim())
    .filter(Boolean);
  const validTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!postId || !connectedChatId) {
    return { error: "پست و مقصد معتبر را انتخاب کنید." };
  }

  if (
    scheduleType === "INTERVAL" &&
    (!Number.isInteger(intervalHours) || intervalHours < 2)
  ) {
    return { error: "فاصله زمانی معتبر را انتخاب کنید." };
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

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    },
    select: { id: true, botId: true },
  });
  if (!post) return { error: "پست یافت نشد یا به آن دسترسی ندارید." };

  const connectedChat = await prisma.connectedChat.findFirst({
    where: {
      id: connectedChatId,
      botId: post.botId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platform),
      },
    },
  });

  if (!connectedChat) {
    return { error: "مقصد انتخاب‌شده به این ربات متصل نیست." };
  }

  await prisma.campaign.create({
    data: {
      botId: post.botId,
      postId: post.id,
      chatId: connectedChat.chatId,
      chatTitle: connectedChat.chatTitle,
      scheduleType:
        scheduleType === "SPECIFIC_TIMES"
          ? "SPECIFIC_TIMES"
          : "INTERVAL",
      intervalHours: scheduleType === "INTERVAL" ? intervalHours : null,
      specificTimes:
        scheduleType === "SPECIFIC_TIMES"
          ? [...new Set(specificTimes)].sort()
          : [],
      isActive: true,
      nextRun:
        scheduleType === "SPECIFIC_TIMES"
          ? calculateNextRunForSpecificTimes(specificTimes)
          : new Date(Date.now() + intervalHours * 60 * 60 * 1000),
    },
  });

  revalidatePath(dashboardPath(platform, "campaigns"));
  revalidatePath(dashboardPath(platform, `bots/${post.botId}`));
  revalidatePath(dashboardPath(platform));
  return { success: true };
}

export async function sendPostNowAction(
  platform: PlatformSlug,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const postId = String(formData.get("postId") ?? "");
  const connectedChatId = String(formData.get("connectedChatId") ?? "");

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
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
    },
  });

  if (!post) return { error: "پست یافت نشد یا به آن دسترسی ندارید." };
  if (!post.bot.isActive) {
    return { error: "برای ارسال، ابتدا ربات را فعال کنید." };
  }

  const connectedChat = await prisma.connectedChat.findFirst({
    where: { id: connectedChatId, botId: post.botId },
  });

  if (!connectedChat) {
    return { error: "مقصد انتخاب‌شده به این ربات متصل نیست." };
  }

  const method =
    post.sourceChatId && post.sourceMessageId ? "copyMessage" : "sendMessage";
  const payload =
    method === "copyMessage"
      ? {
          chat_id: connectedChat.chatId,
          from_chat_id: post.sourceChatId,
          message_id: post.sourceMessageId,
        }
      : {
          chat_id: connectedChat.chatId,
          text: post.content || "محتوای بدون متن",
        };

  try {
    const result = await getBotPlatformProviderBySlug(platform).call(
      post.bot.token,
      method,
      payload,
    );

    if (!result.ok) {
      return {
        error:
          result.description ||
          `ارسال پیام در ${platformConfigs[platform].labelFa} انجام نشد.`,
      };
    }

    return { success: true };
  } catch {
    return {
      error: `ارتباط با ${platformConfigs[platform].labelFa} برقرار نشد. دوباره تلاش کنید.`,
    };
  }
}
