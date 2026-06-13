/* eslint-disable @typescript-eslint/no-explicit-any */

import prisma from "@/lib/prisma";
import { callTelegramAPI } from "@/lib/telegram/api";
import { handleCallbackQuery } from "@/lib/telegram/handlers/callback";
import { handleCampaignsCommand } from "@/lib/telegram/handlers/campaigns";
import { handleDraftPost } from "@/lib/telegram/handlers/draft";
import {
  handleGroupAddition,
  handleNewChatMembers,
} from "@/lib/telegram/handlers/group";
import type { BotPlatformValue } from "@/services/bot-platforms/config";
import { runWithBotPlatform } from "@/services/bot-platforms/context";
import { verifyPairingCode } from "@/services/bot-platforms/pairing";
import { handleTelegramSubscriberUpdate } from "@/services/audience-notifications/webhook";

export async function dispatchUserBotUpdate(
  platform: BotPlatformValue,
  receivedToken: string,
  update: any,
) {
  const bot = await prisma.bot.findFirst({
    where: { platform, token: receivedToken },
    include: { user: true },
  });

  if (!bot) return { ok: false, status: 404, error: "Bot not found" };
  if (!bot.isActive) return { ok: true, status: 200 };

  return runWithBotPlatform(platform, async () => {
    const senderId = (
      update.message?.from?.id ??
      update.callback_query?.from?.id ??
      update.my_chat_member?.from?.id
    )?.toString();

    if (!bot.ownerPlatformUserId) {
      await handleOwnerPairing(update, senderId, bot);
      return { ok: true, status: 200 };
    }

    if (
      senderId &&
      senderId !== bot.ownerPlatformUserId &&
      (await handleTelegramSubscriberUpdate(update, bot))
    ) {
      return { ok: true, status: 200 };
    }

    if (!senderId || senderId !== bot.ownerPlatformUserId) {
      return { ok: true, status: 200 };
    }

    if (update.my_chat_member) {
      await handleGroupAddition(update.my_chat_member, bot);
      return { ok: true, status: 200 };
    }

    if (update.message?.new_chat_members) {
      await handleNewChatMembers(update.message, bot);
      return { ok: true, status: 200 };
    }

    if (update.message) {
      const text = update.message.text;

      if (text === "/start") {
        await callTelegramAPI(
          "sendMessage",
          {
            chat_id: update.message.chat.id,
            text: "🤖 **به پنل مدیریت ربات خود خوش آمدید.**\n\nلطفاً یکی از گزینه‌های زیر را انتخاب کنید:",
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📝 ایجاد پست جدید",
                    callback_data: "menu_new_post",
                  },
                ],
                [
                  {
                    text: "📊 مدیریت کمپین‌ها",
                    callback_data: "menu_campaigns",
                  },
                ],
                [
                  {
                    text: "👥 مدیریت گروه‌ها",
                    callback_data: "menu_groups",
                  },
                ],
                [
                  {
                    text: "📖 آموزش استفاده",
                    callback_data: "menu_help",
                  },
                ],
              ],
            },
          },
          bot.token,
        );
      } else if (text?.startsWith("/campaigns")) {
        await handleCampaignsCommand(update.message, bot);
      } else {
        await handleDraftPost(update.message, bot);
      }
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot);
    }

    return { ok: true, status: 200 };
  });
}

async function handleOwnerPairing(
  update: any,
  senderId: string | undefined,
  bot: {
    id: string;
    token: string;
    connectionCodeHash: string | null;
    connectionCodeExpiresAt: Date | null;
  },
) {
  const message = update.message;
  const text = message?.text?.trim() ?? "";
  const match = text.match(/^\/connect\s+([A-Fa-f0-9]{8})$/);

  if (
    !senderId ||
    message?.chat?.type !== "private" ||
    !match ||
    !bot.connectionCodeHash ||
    !bot.connectionCodeExpiresAt ||
    bot.connectionCodeExpiresAt.getTime() < Date.now() ||
    !verifyPairingCode(match[1], bot.connectionCodeHash)
  ) {
    if (message?.chat?.type === "private") {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: message.chat.id,
          text: "برای اتصال امن این ربات، دستور اتصال نمایش‌داده‌شده در داشبورد را ارسال کنید.",
        },
        bot.token,
      );
    }
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

  await callTelegramAPI(
    "sendMessage",
    {
      chat_id: message.chat.id,
      text: "✅ حساب شما با موفقیت به ربات متصل شد. اکنون دستور /start را ارسال کنید.",
    },
    bot.token,
  );
}
