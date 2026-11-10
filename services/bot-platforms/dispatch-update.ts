/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Bot } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { BotPlatformValue } from "@/services/bot-platforms/config";
import { runWithBotPlatform } from "@/services/bot-platforms/context";
import { verifyPairingCode } from "@/services/bot-platforms/pairing";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import { handleTelegramSubscriberUpdate } from "@/services/audience-notifications/webhook";
import {
  handleOwnerCallback,
  handleOwnerMessage,
} from "@/services/owner-bot/handler";
import {
  applyMembershipUpdate,
  applyServiceMessage,
  membershipNotice,
  type MembershipChange,
} from "@/services/publishing/destinations";

export type DispatchResult = { ok: boolean; status: number; error?: string };

function senderOf(update: any): string | undefined {
  return (
    update.message?.from?.id ??
    update.callback_query?.from?.id ??
    update.my_chat_member?.from?.id
  )?.toString();
}

async function notifyOwner(bot: Bot, change: MembershipChange | null) {
  if (!change || !bot.ownerPlatformUserId) return;
  await getBotPlatformProvider(bot.platform).call(bot.token, "sendMessage", {
    chat_id: bot.ownerPlatformUserId,
    text: membershipNotice(change),
  });
}

/** Routes one platform update for a user-owned bot. */
export async function dispatchBotUpdate(bot: Bot, update: any): Promise<DispatchResult> {
  if (!bot.isActive) return { ok: true, status: 200 };

  return runWithBotPlatform(bot.platform, async () => {
    // Membership changes apply even when someone else removes the bot.
    if (update.my_chat_member) {
      await notifyOwner(bot, await applyMembershipUpdate(bot, update.my_chat_member));
      return { ok: true, status: 200 };
    }
    if (update.message && update.message.chat?.type !== "private") {
      await notifyOwner(bot, await applyServiceMessage(bot, update.message));
      return { ok: true, status: 200 };
    }
    if (!update.message && !update.callback_query) {
      return { ok: true, status: 200 };
    }

    const senderId = senderOf(update);
    if (!bot.ownerPlatformUserId) {
      await handleOwnerPairing(update, senderId, bot);
      return { ok: true, status: 200 };
    }

    if (senderId !== bot.ownerPlatformUserId) {
      if (senderId) await handleTelegramSubscriberUpdate(update, bot);
      return { ok: true, status: 200 };
    }

    if (update.callback_query) {
      await handleOwnerCallback(bot, update.callback_query);
    } else {
      await handleOwnerMessage(bot, update.message);
    }
    return { ok: true, status: 200 };
  });
}

/** Legacy webhook URLs identify the bot by platform and token. */
export async function dispatchUserBotUpdate(
  platform: BotPlatformValue,
  receivedToken: string,
  update: any,
): Promise<DispatchResult> {
  const bot = await prisma.bot.findFirst({
    where: { platform, token: receivedToken },
  });
  if (!bot) return { ok: false, status: 404, error: "Bot not found" };
  return dispatchBotUpdate(bot, update);
}

async function handleOwnerPairing(
  update: any,
  senderId: string | undefined,
  bot: Bot,
) {
  const message = update.message;
  if (message?.chat?.type !== "private") return;
  const text = message?.text?.trim() ?? "";
  const match =
    text.match(/^\/connect\s+([A-Fa-f0-9]{8})$/) ??
    text.match(/^\/start\s+pair_([A-Fa-f0-9]{8})$/);
  const provider = getBotPlatformProvider(bot.platform);

  if (
    !senderId ||
    !match ||
    !bot.connectionCodeHash ||
    !bot.connectionCodeExpiresAt ||
    bot.connectionCodeExpiresAt.getTime() < Date.now() ||
    !verifyPairingCode(match[1], bot.connectionCodeHash)
  ) {
    await provider.call(bot.token, "sendMessage", {
      chat_id: message.chat.id,
      text: "این ربات هنوز به حساب مالک متصل نشده است. برای اتصال، دستور نمایش‌داده‌شده در داشبورد را ارسال کنید.",
    });
    return;
  }

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      ownerPlatformUserId: senderId,
      connectionCodeHash: null,
      connectionCodeExpiresAt: null,
    },
  });

  await provider.call(bot.token, "sendMessage", {
    chat_id: message.chat.id,
    text: "✅ حساب شما به‌عنوان مالک به ربات متصل شد.\nحالا ربات را به کانال یا گروه خود اضافه کنید و برای مدیریت /start را بفرستید.",
  });
}
