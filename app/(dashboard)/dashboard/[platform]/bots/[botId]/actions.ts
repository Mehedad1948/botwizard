"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformConfigs,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { getBotPlatformProviderBySlug } from "@/services/bot-platforms/provider";
import { registerWebhook } from "@/services/bots/connection";
import { findActionBot } from "@/services/dashboard/access";
import {
  checkDestination,
  DESTINATION_STATUS_LABELS,
} from "@/services/publishing/destinations";

type ActionResult = {
  success?: boolean;
  error?: string;
};

function revalidateBotPages(platform: PlatformSlug, botId: string) {
  revalidatePath(dashboardPath(platform));
  revalidatePath(dashboardPath(platform, "bots"));
  revalidatePath(dashboardPath(platform, `bots/${botId}`));
  revalidatePath(dashboardPath(platform, "campaigns"));
}

export async function toggleBotStatusAction(
  platform: PlatformSlug,
  botId: string,
): Promise<ActionResult> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  await prisma.bot.update({
    where: { id: bot.id },
    data: { isActive: !bot.isActive },
  });

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function repairConnectionAction(
  platform: PlatformSlug,
  botId: string,
): Promise<ActionResult> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  try {
    await registerWebhook(bot);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "اتصال ربات دوباره برقرار نشد.",
    };
  }

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function checkDestinationAction(
  platform: PlatformSlug,
  botId: string,
  destinationId: string,
): Promise<ActionResult> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const checked = await checkDestination(bot, destinationId);
  revalidateBotPages(platform, botId);
  if (!checked) return { error: "مقصد پیدا نشد." };
  if (checked.checkFailed) {
    return { error: "ارتباط با پیام‌رسان برقرار نشد؛ کمی بعد دوباره امتحان کنید." };
  }
  if (checked.status !== "ACTIVE") {
    return { error: `وضعیت: ${DESTINATION_STATUS_LABELS[checked.status]}` };
  }
  return { success: true };
}

export async function leaveConnectedChatAction(
  platform: PlatformSlug,
  botId: string,
  connectedChatId: string,
): Promise<ActionResult> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const destination = await prisma.connectedChat.findFirst({
    where: { id: connectedChatId, botId: bot.id },
  });
  if (!destination) return { error: "مقصد موردنظر یافت نشد." };

  if (destination.status !== "REMOVED") {
    const result = await getBotPlatformProviderBySlug(platform).call(
      bot.token,
      "leaveChat",
      { chat_id: destination.chatId },
    );
    if (!result.ok && !/not found|not a member|kicked/i.test(result.description ?? "")) {
      return {
        error:
          result.description ||
          `${platformConfigs[platform].labelFa} اجازه خروج ربات از این مقصد را نداد.`,
      };
    }
  }

  // Deleting the destination drops it from campaign targets; history keeps a snapshot.
  await prisma.connectedChat.delete({ where: { id: destination.id } });

  revalidateBotPages(platform, botId);
  return { success: true };
}
