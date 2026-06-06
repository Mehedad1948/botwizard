// src/lib/telegram/handlers/draft.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

// تابع کمکی برای پیدا کردن نزدیک‌ترین زمان اجرای بعدی
function calculateNextRunForSpecificTimes(times: string[]): Date {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  const sortedTimes = [...times].sort();
  let nextTime = sortedTimes.find(t => t > currentTimeStr);
  const nextRunDate = new Date(now);

  if (nextTime) {
    // اجرا در همین امروز
    const [h, m] = nextTime.split(":");
    nextRunDate.setHours(parseInt(h), parseInt(m), 0, 0);
  } else {
    // اجرا در فردا (ساعات امروز گذشته‌اند)
    nextTime = sortedTimes[0];
    const [h, m] = nextTime.split(":");
    nextRunDate.setDate(nextRunDate.getDate() + 1);
    nextRunDate.setHours(parseInt(h), parseInt(m), 0, 0);
  }
  return nextRunDate;
}

export async function handleDraftPost(message: any, bot: Bot) {
  const chatId = message.chat.id;

  // ۱. بررسی پاسخ به پیامِ تعیین ساعات خاص (force_reply)
  if (message.reply_to_message && message.reply_to_message.text?.includes("#SchData_")) {
    const replyText = message.reply_to_message.text;
    const dataMatch = replyText.match(/#SchData_(\d+)_([0-9,\-]+)/);

    if (dataMatch) {
      const targetGroups = dataMatch[2].split(",");
      const userTimes = message.text || "";

      // اعتبارسنجی فرمت زمان‌ها (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const parsedTimes = userTimes.split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => timeRegex.test(t));

      if (parsedTimes.length === 0) {
        await callTelegramAPI("sendMessage", {
          chat_id: chatId,
          text: "❌ فرمت ساعات نامعتبر است. لطفاً دقیقاً مانند مثال وارد کنید (مثال: 10:00, 18:30).",
          reply_to_message_id: message.message_id
        }, bot.token);
        return;
      }

      try {
        const latestPost = await prisma.post.findFirst({
          where: { botId: bot.id },
          orderBy: { createdAt: 'desc' }
        });

        if (!latestPost) throw new Error("Post not found");

        const nextRun = calculateNextRunForSpecificTimes(parsedTimes);

        // --- اضافه شده: دریافت نام گروه‌ها از دیتابیس ---
        const connectedChats = await prisma.connectedChat.findMany({
          where: { botId: bot.id, chatId: { in: targetGroups } }
        });
        const chatTitleMap = new Map(connectedChats.map(c => [c.chatId, c.chatTitle]));
        // ------------------------------------------------

        for (const tId of targetGroups) {
          await prisma.campaign.create({
            data: {
              botId: bot.id,
              postId: latestPost.id,
              chatId: tId,
              chatTitle: chatTitleMap.get(tId) || "گروه ناشناس", // <-- اصلاح شد
              scheduleType: "SPECIFIC_TIMES",
              specificTimes: parsedTimes,
              isActive: true,
              nextRun: nextRun,
            }
          });
        }

        await callTelegramAPI("sendMessage", {
          chat_id: chatId,
          text: `✅ زمان‌بندی با موفقیت انجام شد.\nپست شما در ${targetGroups.length} گروه هر روز در ساعات [${parsedTimes.join(" - ")}] ارسال خواهد شد.`
        }, bot.token);

      } catch (error: any) {
        console.error("Error creating specific times campaign:", error);

        // استخراج متن خطا
        const errorMessage = error?.message || String(error);

        // TODO: Remove the error message from the response for security/cleanliness in production
        await callTelegramAPI("sendMessage", {
          chat_id: chatId,
          text: `❌ خطایی در ذخیره زمان‌بندی رخ داد.\n\nجزئیات خطا:\n${errorMessage}`
        }, bot.token);
      }

      return;
    }
  }

  // ۲. منطق دریافت پیام پیش‌نویس جدید
  if (message.chat.type === "private" && !message.text?.startsWith("/")) {
    const draftId = message.message_id;
    const textPreview = message.text || message.caption || "🖼 مدیا/فایل";
    try {
      await prisma.post.create({
        data: {
          botId: bot.id,
          content: textPreview, 
          sourceChatId: chatId.toString(),
          sourceMessageId: draftId,
        }
      });

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
