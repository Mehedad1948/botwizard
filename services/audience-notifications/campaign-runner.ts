import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import {
  createOccurrenceKey,
  dispatchCampaignSubscribers,
} from "./dispatch";

export async function runCampaignDelivery(input: {
  campaignId: string;
  operationId?: string;
  scheduledFor?: Date | null;
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: {
      bot: {
        select: {
          id: true,
          token: true,
          platform: true,
          isActive: true,
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
  if (!campaign) return { ok: false as const, error: "Campaign not found" };
  if (!campaign.bot.isActive) {
    return { ok: false as const, error: "Bot is inactive" };
  }

  const method =
    campaign.post.sourceChatId && campaign.post.sourceMessageId
      ? "copyMessage"
      : "sendMessage";
  const publicResult = await getBotPlatformProvider(campaign.bot.platform).call(
    campaign.bot.token,
    method,
    method === "copyMessage"
      ? {
          chat_id: campaign.chatId,
          from_chat_id: campaign.post.sourceChatId,
          message_id: campaign.post.sourceMessageId,
        }
      : {
          chat_id: campaign.chatId,
          text: campaign.post.content || "محتوای بدون متن",
        },
  );

  await prisma.postHistory.create({
    data: {
      campaignId: campaign.id,
      status: publicResult.ok ? "SUCCESS" : "FAILED",
      errorLog: publicResult.ok ? null : publicResult.description?.slice(0, 1000),
    },
  });

  if (!publicResult.ok) {
    return {
      ok: false as const,
      error: publicResult.description || "Public campaign delivery failed",
      subscriberSummary: null,
    };
  }

  const occurrenceKey = createOccurrenceKey({
    operationId: input.operationId,
    scheduledFor: input.scheduledFor,
  });
  const subscriberSummary = await dispatchCampaignSubscribers({
    campaignId: campaign.id,
    occurrenceKey,
    scheduledFor: input.scheduledFor,
  });

  return { ok: true as const, subscriberSummary };
}
