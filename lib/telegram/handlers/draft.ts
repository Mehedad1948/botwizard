// src/lib/telegram/handlers/draft.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleDraftPost(message: any, bot: Bot) {
  if (message.chat.type === "private" && !message.text?.startsWith("/")) {
    const draftId = message.message_id;
    const chatId = message.chat.id;

    try {
      // ذخیره پست در دیتابیس با استفاده از bot.id
      await prisma.post.create({
        data: {
          botId: bot.id,
          content: message.text || "مدیا/فایل", 
        }
      });

      // نمایش دکمه‌ها
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        reply_to_message_id: draftId,
        text: "📌 محتوای شما دریافت و ذخیره شد.\nچه کاری می‌خواهید انجام دهید؟",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🚀 ارسال فوری", callback_data: `send_now_${draftId}` },
              { text: "📅 زمان‌بندی", callback_data: `sch_${draftId}` }
            ],
            [{ text: "❌ لغو", callback_data: "cancel_draft" }]
          ]
        }
      }, bot.token);

    } catch (error) {
      console.error("Error saving draft post:", error);
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: "❌ خطایی در ذخیره پست رخ داد. لطفاً مجدداً تلاش کنید."
      }, bot.token);
    }
  }
}
