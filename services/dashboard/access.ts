import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

/** For pages: redirects to login when signed out. */
export async function requirePageUser() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  return session.userId;
}

/** For pages: resolves the platform segment and an owned bot or 404s. */
export async function requirePageBot(platform: string, botId: string) {
  const userId = await requirePageUser();
  const platformSlug = requirePlatformSlug(platform);
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId, platform: platformFromSlug(platformSlug) },
  });
  if (!bot) notFound();
  return { userId, platformSlug, bot };
}

export type ActionResult<T = undefined> =
  | ({ success: true; error?: undefined } & (T extends undefined ? object : { data: T }))
  | { success?: false; error: string };

/** For Server Actions: returns the owned bot or null. Never trusts the client. */
export async function findActionBot(platform: PlatformSlug, botId: string) {
  const session = await getSession();
  if (!session?.userId) return null;
  return prisma.bot.findFirst({
    where: {
      id: botId,
      userId: session.userId,
      platform: platformFromSlug(platform),
    },
  });
}

/** For Server Actions: resolves a campaign's bot only if the user owns it. */
export async function findActionCampaignBot(platform: PlatformSlug, campaignId: string) {
  const session = await getSession();
  if (!session?.userId) return null;
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: { userId: session.userId, platform: platformFromSlug(platform) },
    },
    select: { botId: true },
  });
  return campaign?.botId ?? null;
}
