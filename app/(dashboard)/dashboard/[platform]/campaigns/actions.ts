"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { revalidatePath } from "next/cache";

function revalidateCampaignPages(
  platform: PlatformSlug,
  campaignId: string,
  botId: string,
) {
  revalidatePath(dashboardPath(platform));
  revalidatePath(dashboardPath(platform, "campaigns"));
  revalidatePath(dashboardPath(platform, `campaigns/${campaignId}`));
  revalidatePath(dashboardPath(platform, `bots/${botId}`));
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
