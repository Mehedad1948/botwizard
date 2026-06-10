"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { getBotPlatformProviderBySlug } from "@/services/bot-platforms/provider";
import { revalidatePath } from "next/cache";

type ActionResult = {
  success?: boolean;
  error?: string;
};

async function getOwnedBot(platform: PlatformSlug, botId: string) {
  const session = await getSession();
  if (!session?.userId) return null;

  return prisma.bot.findFirst({
    where: {
      id: botId,
      userId: session.userId,
      platform: platformFromSlug(platform),
    },
    select: { id: true, token: true, isActive: true },
  });
}

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
  const bot = await getOwnedBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  await prisma.bot.update({
    where: { id: bot.id },
    data: { isActive: !bot.isActive },
  });

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function toggleCampaignStatusAction(
  platform: PlatformSlug,
  botId: string,
  campaignId: string,
): Promise<ActionResult> {
  const bot = await getOwnedBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, botId: bot.id },
    select: { id: true, isActive: true },
  });
  if (!campaign) return { error: "کمپین موردنظر یافت نشد." };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { isActive: !campaign.isActive },
  });

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function deleteCampaignAction(
  platform: PlatformSlug,
  botId: string,
  campaignId: string,
): Promise<ActionResult> {
  const bot = await getOwnedBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const deleted = await prisma.campaign.deleteMany({
    where: { id: campaignId, botId: bot.id },
  });
  if (deleted.count !== 1) return { error: "کمپین موردنظر یافت نشد." };

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function deletePostAction(
  platform: PlatformSlug,
  botId: string,
  postId: string,
): Promise<ActionResult> {
  const bot = await getOwnedBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const deleted = await prisma.post.deleteMany({
    where: { id: postId, botId: bot.id },
  });
  if (deleted.count !== 1) return { error: "پست موردنظر یافت نشد." };

  revalidateBotPages(platform, botId);
  return { success: true };
}

export async function leaveConnectedChatAction(
  platform: PlatformSlug,
  botId: string,
  connectedChatId: string,
): Promise<ActionResult> {
  const bot = await getOwnedBot(platform, botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const connectedChat = await prisma.connectedChat.findFirst({
    where: { id: connectedChatId, botId: bot.id },
  });
  if (!connectedChat) return { error: "مقصد موردنظر یافت نشد." };

  const result = await getBotPlatformProviderBySlug(platform).call(
    bot.token,
    "leaveChat",
    { chat_id: connectedChat.chatId },
  );
  if (!result.ok) {
    return {
      error:
        result.description ||
        `${platformConfigs[platform].labelFa} اجازه خروج ربات از این مقصد را نداد.`,
    };
  }

  await prisma.$transaction([
    prisma.connectedChat.delete({ where: { id: connectedChat.id } }),
    prisma.campaign.updateMany({
      where: { botId: bot.id, chatId: connectedChat.chatId },
      data: { isActive: false },
    }),
  ]);

  revalidateBotPages(platform, botId);
  return { success: true };
}
