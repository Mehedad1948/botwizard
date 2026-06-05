"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function toggleCampaignAction(campaignId: string, currentStatus: boolean) {
  const session = await getSession();
  if (!session?.userId) throw new Error("Unauthorized");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { isActive: !currentStatus },
  });
  revalidatePath("/dashboard/campaigns");
}

export async function deleteCampaignAction(campaignId: string) {
  const session = await getSession();
  if (!session?.userId) throw new Error("Unauthorized");

  await prisma.campaign.delete({
    where: { id: campaignId },
  });
  revalidatePath("/dashboard/campaigns");
}
