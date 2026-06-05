/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleDraftPost(message: any, botToken: string) {
  if (message.chat.type === "private" && !message.text?.startsWith("/")) {
    const draftId = message.message_id;
    const chatId = message.chat.id;
    const telegramId = message.from.id.toString();

    try {
      // ۱. پیدا کردن کاربر و ربات متصل به او
      const user = await prisma.user.findUnique({
        where: { telegramId },
        include: { bots: true }
      });

      if (!user || user.bots.length === 0) {
        await callTelegramAPI("sendMessage", {
          chat_id: chatId,
          text: "❌ شما هنوز هیچ رباتی نساخته‌اید. ابتدا از طریق پنل کاربری یک ربات ایجاد کنید."
        }, botToken);
        return;
      }

      const bot = user.bots[0];

      // ۲. ذخیره پست در دیتابیس
      await prisma.post.create({
        data: {
          botId: bot.id,
          content: message.text || "مدیا/فایل", // در صورت ارسال عکس یا ویدیو
        }
      });

      // ۳. نمایش دکمه‌ها
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
      }, botToken);

    } catch (error) {
      console.error("Error saving draft post:", error);
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: "❌ خطایی در ذخیره پست رخ داد. لطفاً مجدداً تلاش کنید."
      }, botToken);
    }
  }
}
