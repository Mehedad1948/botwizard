// src/lib/telegram/handlers/campaigns.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleCampaignsCommand(message: any, bot: Bot) {
  const chatId = message.chat.id;

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { botId: bot.id },
      include: { post: true }
    });

    if (campaigns.length === 0) {
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: "📭 شما هیچ کمپین فعالی ندارید."
      }, bot.token);
      return;
    }

    for (const camp of campaigns) {
      const groupName = camp.chatTitle || camp.chatId;
      const statusText = camp.isActive ? "✅ فعال" : "⏸ متوقف شده";
      const nextRunDate = camp.nextRun 
        ? new Date(camp.nextRun).toLocaleString("fa-IR") 
        : "نامشخص";

      // تشخیص نوع نمایش زمان‌بندی
      let scheduleText = "";
      if (camp.scheduleType === "INTERVAL") {
          scheduleText = `هر ${camp.intervalHours} ساعت`;
      } else if (camp.scheduleType === "SPECIFIC_TIMES") {
          scheduleText = `ساعات ${camp.specificTimes.join(" و ")}`;
      }

      const text = `📢 گروه: ${groupName}\n📝 پست: ${camp.post.content?.substring(0, 20)}...\n⏳ تکرار: ${scheduleText}\nوضعیت: ${statusText}\n🗓 اجرای بعدی: ${nextRunDate}`;

      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: text,
        reply_markup: {
          inline_keyboard: [
            [
              camp.isActive 
                ? { text: "⏸ توقف", callback_data: `pause_camp_${camp.id}` }
                : { text: "▶️ ادامه", callback_data: `resume_camp_${camp.id}` },
              { text: "🗑 حذف", callback_data: `del_camp_${camp.id}` }
            ]
          ]
        }
      }, bot.token);
    }
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: "❌ خطایی در دریافت لیست کمپین‌ها رخ داد."
    }, bot.token);
  }
}
