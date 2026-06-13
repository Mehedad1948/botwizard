/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Bot } from "@prisma/client";

import { callTelegramAPI } from "@/lib/telegram/api";
import {
  listSubscriberTopics,
  toggleSubscriberTopic,
} from "./preferences";
import {
  findBotSubscriber,
  setSubscriberStatus,
  upsertBotSubscriber,
} from "./subscribers";
import {
  parseStartParameter,
  parseSubscriberCallback,
  type PrivateSubscriberIdentity,
} from "./types";

const SUBSCRIBER_COMMANDS = new Set([
  "/start",
  "/topics",
  "/notify",
  "/settings",
  "/stop",
]);

function normalizedCommand(text: unknown) {
  if (typeof text !== "string") return null;
  const command = text.trim().split(/\s+/, 1)[0].split("@", 1)[0];
  return SUBSCRIBER_COMMANDS.has(command) ? command : null;
}

function identityFromMessage(message: any): PrivateSubscriberIdentity | null {
  if (
    message?.chat?.type !== "private" ||
    message?.from?.id === undefined ||
    message?.chat?.id === undefined
  ) {
    return null;
  }

  return {
    platform: "TELEGRAM",
    platformUserId: String(message.from.id),
    privateChatId: String(message.chat.id),
    username: message.from.username,
    firstName: message.from.first_name,
    lastName: message.from.last_name,
    languageCode: message.from.language_code,
  };
}

export async function handleTelegramSubscriberUpdate(
  update: any,
  bot: Bot,
): Promise<boolean> {
  if (bot.platform !== "TELEGRAM") return false;

  if (update.message) {
    const command = normalizedCommand(update.message.text);
    const identity = identityFromMessage(update.message);
    if (!command || !identity) return false;

    if (command === "/start") {
      await upsertBotSubscriber({
        botId: bot.id,
        identity,
        source: "telegram-private-start",
        startParameter: parseStartParameter(update.message.text),
      });
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: identity.privateChatId,
          text:
            "به سامانه اعلان‌های این ربات خوش آمدید.\n\nموضوع‌های مورد علاقه‌تان را انتخاب کنید تا فقط اعلان‌های مرتبط برای شما ارسال شود.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "انتخاب موضوع‌های اعلان", callback_data: "topic:list" }],
            ],
          },
        },
        bot.token,
      );
      return true;
    }

    const subscriber = await findBotSubscriber(
      bot.id,
      identity.platformUserId,
    );
    if (!subscriber) {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: identity.privateChatId,
          text: "برای فعال‌کردن اعلان‌ها ابتدا دستور /start را ارسال کنید.",
        },
        bot.token,
      );
      return true;
    }

    if (command === "/stop") {
      await setSubscriberStatus({
        botId: bot.id,
        platformUserId: identity.platformUserId,
        status: "UNSUBSCRIBED",
      });
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: identity.privateChatId,
          text:
            "اعلان‌های خصوصی برای شما غیرفعال شد. هر زمان خواستید با /start دوباره فعال کنید.",
        },
        bot.token,
      );
      return true;
    }

    await renderTopicSettings({
      bot,
      platformUserId: identity.platformUserId,
      chatId: identity.privateChatId,
    });
    return true;
  }

  const callback = update.callback_query;
  const action = parseSubscriberCallback(callback?.data);
  if (!action) return false;

  const message = callback?.message;
  const senderId = callback?.from?.id;
  if (
    message?.chat?.type !== "private" ||
    message?.chat?.id === undefined ||
    senderId === undefined
  ) {
    await answerCallback(bot, callback?.id, "این عملیات فقط در گفت‌وگوی خصوصی مجاز است.");
    return true;
  }

  const platformUserId = String(senderId);
  const chatId = String(message.chat.id);
  const subscriber = await findBotSubscriber(bot.id, platformUserId);
  if (!subscriber || subscriber.privateChatId !== chatId) {
    console.warn("[Subscriber callback rejected]", {
      botId: bot.id,
      platformUserId,
    });
    await answerCallback(bot, callback.id, "درخواست معتبر نیست.");
    return true;
  }

  if (action.type === "STOP") {
    await setSubscriberStatus({
      botId: bot.id,
      platformUserId,
      status: "UNSUBSCRIBED",
    });
    await answerCallback(bot, callback.id, "اعلان‌ها غیرفعال شد.");
    await callTelegramAPI(
      "editMessageText",
      {
        chat_id: chatId,
        message_id: message.message_id,
        text:
          "اعلان‌های خصوصی برای شما غیرفعال است. برای فعال‌سازی دوباره /start را ارسال کنید.",
      },
      bot.token,
    );
    return true;
  }

  if (action.type === "TOGGLE") {
    const result = await toggleSubscriberTopic({
      botId: bot.id,
      platformUserId,
      callbackKey: action.callbackKey,
    });
    if (!result) {
      await answerCallback(bot, callback.id, "این موضوع دیگر در دسترس نیست.");
      return true;
    }
    await answerCallback(
      bot,
      callback.id,
      result.isEnabled ? "موضوع فعال شد." : "موضوع غیرفعال شد.",
    );
  } else {
    await answerCallback(bot, callback.id);
  }

  await renderTopicSettings({
    bot,
    platformUserId,
    chatId,
    messageId: message.message_id,
  });
  return true;
}

async function renderTopicSettings(input: {
  bot: Bot;
  platformUserId: string;
  chatId: string;
  messageId?: number;
}) {
  const state = await listSubscriberTopics(
    input.bot.id,
    input.platformUserId,
  );
  if (!state.subscriber) return;

  const inactive = state.subscriber.status !== "ACTIVE";
  const text = inactive
    ? "اعلان‌های شما غیرفعال است. با انتخاب یک موضوع یا ارسال /start دوباره فعال می‌شود."
    : state.topics.length
      ? "موضوع‌های مورد علاقه‌تان را انتخاب یا حذف کنید:"
      : "هنوز موضوع فعالی برای این ربات تعریف نشده است.";

  const keyboard = state.topics.map((topic) => [
    {
      text: `${topic.isEnabled ? "✓" : "○"} ${topic.name}`,
      callback_data: `topic:toggle:${topic.callbackKey}`,
    },
  ]);
  keyboard.push([{ text: "توقف همه اعلان‌ها", callback_data: "topic:stop" }]);

  await callTelegramAPI(
    input.messageId ? "editMessageText" : "sendMessage",
    {
      chat_id: input.chatId,
      ...(input.messageId ? { message_id: input.messageId } : {}),
      text,
      reply_markup: { inline_keyboard: keyboard },
    },
    input.bot.token,
  );
}

async function answerCallback(
  bot: Bot,
  callbackQueryId: string | undefined,
  text?: string,
) {
  if (!callbackQueryId) return;
  await callTelegramAPI(
    "answerCallbackQuery",
    {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    },
    bot.token,
  );
}
