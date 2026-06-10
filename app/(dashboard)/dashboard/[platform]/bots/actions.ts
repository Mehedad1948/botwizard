"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import {
  generatePairingCode,
  hashPairingCode,
  pairingCodeExpiresAt,
} from "@/services/bot-platforms/pairing";
import { getBotPlatformProviderBySlug } from "@/services/bot-platforms/provider";
import { revalidatePath } from "next/cache";

export async function addBotAction(
  platform: PlatformSlug,
  formData: FormData,
) {
  const session = await getSession();
  if (!session?.userId) {
    return { error: "ابتدا وارد حساب خود شوید." };
  }

  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "توکن ربات الزامی است." };

  const platformValue = platformFromSlug(platform);
  const config = platformConfigs[platform];
  const provider = getBotPlatformProviderBySlug(platform);

  try {
    const duplicate = await prisma.bot.findFirst({
      where: { platform: platformValue, token },
      select: { id: true },
    });
    if (duplicate) {
      return { error: "این ربات قبلاً در سامانه ثبت شده است." };
    }

    const [identity, user] = await Promise.all([
      provider.getMe(token),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { telegramId: true },
      }),
    ]);
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error(
        "آدرس عمومی سامانه برای ثبت وب‌هوک تنظیم نشده است.",
      );
    }

    const pairingCode =
      platformValue === "BALE" ? generatePairingCode() : null;

    const createdBot = await prisma.bot.create({
      data: {
        userId: session.userId,
        platform: platformValue,
        token,
        username: identity.username!,
        ownerPlatformUserId:
          platformValue === "TELEGRAM" ? user?.telegramId : null,
        connectionCodeHash: pairingCode
          ? hashPairingCode(pairingCode)
          : null,
        connectionCodeExpiresAt: pairingCode
          ? pairingCodeExpiresAt()
          : null,
      },
      select: { id: true },
    });

    try {
      await provider.setWebhook(
        token,
        `${baseUrl}/api/bots/webhook/${platform}/${token}`,
      );
    } catch (error) {
      await prisma.bot.delete({ where: { id: createdBot.id } });
      throw error;
    }

    revalidatePath(dashboardPath(platform, "bots"));
    revalidatePath(dashboardPath(platform));
    return {
      success: true,
      pairingCommand: pairingCode ? `/connect ${pairingCode}` : undefined,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : `ثبت ربات ${config.labelFa} انجام نشد.`,
    };
  }
}

export async function deleteBotAction(
  platform: PlatformSlug,
  botId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const platformValue = platformFromSlug(platform);
  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      userId: session.userId,
      platform: platformValue,
    },
    select: { id: true, token: true },
  });

  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  try {
    await getBotPlatformProviderBySlug(platform).deleteWebhook(bot.token);
  } catch (error) {
    console.warn(
      `${platformConfigs[platform].label} webhook cleanup failed`,
      error,
    );
  }

  await prisma.bot.delete({ where: { id: bot.id } });

  revalidatePath(dashboardPath(platform, "bots"));
  revalidatePath(dashboardPath(platform));
  revalidatePath(dashboardPath(platform, "campaigns"));
  return { success: true };
}

export async function createPairingCodeAction(
  platform: PlatformSlug,
  botId: string,
) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };
  if (platform !== "bale") {
    return { error: "کد اتصال فقط برای ربات‌های بله لازم است." };
  }

  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      userId: session.userId,
      platform: "BALE",
    },
    select: { id: true },
  });
  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  const pairingCode = generatePairingCode();
  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      ownerPlatformUserId: null,
      connectionCodeHash: hashPairingCode(pairingCode),
      connectionCodeExpiresAt: pairingCodeExpiresAt(),
    },
  });

  revalidatePath(dashboardPath(platform, "bots"));
  revalidatePath(dashboardPath(platform, `bots/${bot.id}`));
  return { success: true, pairingCommand: `/connect ${pairingCode}` };
}
