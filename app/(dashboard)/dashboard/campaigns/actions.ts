"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function toggleCampaignAction(campaignId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bot: { userId: session.userId } },
    select: { id: true, botId: true, isActive: true },
  });

  if (!campaign) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { isActive: !campaign.isActive },
  });

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  revalidatePath(`/dashboard/bots/${campaign.botId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCampaignAction(campaignId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bot: { userId: session.userId } },
    select: { id: true, botId: true },
  });

  if (!campaign) return { error: "کمپین یافت نشد یا به آن دسترسی ندارید." };

  await prisma.campaign.delete({ where: { id: campaign.id } });

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/bots/${campaign.botId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
