"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

type ActionResult = {
  success?: boolean;
  error?: string;
};

async function getOwnedBot(botId: string) {
  const session = await getSession();
  if (!session?.userId) return null;

  return prisma.bot.findFirst({
    where: { id: botId, userId: session.userId },
    select: { id: true, token: true, isActive: true },
  });
}

function revalidateBotPages(botId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bots");
  revalidatePath(`/dashboard/bots/${botId}`);
  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/posts");
}

export async function toggleBotStatusAction(
  botId: string
): Promise<ActionResult> {
  const bot = await getOwnedBot(botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  await prisma.bot.update({
    where: { id: bot.id },
    data: { isActive: !bot.isActive },
  });

  revalidateBotPages(botId);
  return { success: true };
}

export async function toggleCampaignStatusAction(
  botId: string,
  campaignId: string
): Promise<ActionResult> {
  const bot = await getOwnedBot(botId);
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

  revalidateBotPages(botId);
  return { success: true };
}

export async function deleteCampaignAction(
  botId: string,
  campaignId: string
): Promise<ActionResult> {
  const bot = await getOwnedBot(botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const deleted = await prisma.campaign.deleteMany({
    where: { id: campaignId, botId: bot.id },
  });

  if (deleted.count !== 1) return { error: "کمپین موردنظر یافت نشد." };

  revalidateBotPages(botId);
  return { success: true };
}

export async function deletePostAction(
  botId: string,
  postId: string
): Promise<ActionResult> {
  const bot = await getOwnedBot(botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const deleted = await prisma.post.deleteMany({
    where: { id: postId, botId: bot.id },
  });

  if (deleted.count !== 1) return { error: "پست موردنظر یافت نشد." };

  revalidateBotPages(botId);
  return { success: true };
}

export async function leaveConnectedChatAction(
  botId: string,
  connectedChatId: string
): Promise<ActionResult> {
  const bot = await getOwnedBot(botId);
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const connectedChat = await prisma.connectedChat.findFirst({
    where: { id: connectedChatId, botId: bot.id },
  });

  if (!connectedChat) return { error: "مقصد موردنظر یافت نشد." };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${bot.token}/leaveChat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: connectedChat.chatId }),
      }
    );
    const result = await response.json();

    if (!response.ok || !result.ok) {
      return {
        error:
          result.description ||
          "تلگرام اجازه خروج ربات از این مقصد را نداد.",
      };
    }

    await prisma.$transaction([
      prisma.connectedChat.delete({
        where: { id: connectedChat.id },
      }),
      prisma.campaign.updateMany({
        where: { botId: bot.id, chatId: connectedChat.chatId },
        data: { isActive: false },
      }),
    ]);

    revalidateBotPages(botId);
    return { success: true };
  } catch {
    return { error: "ارتباط با تلگرام برقرار نشد. دوباره تلاش کنید." };
  }
}
