// src/lib/telegram/handlers/campaigns.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleCampaignsCommand(message: any, bot: Bot, editMessageId?: number) {
  const chatId = message.chat?.id || message.message?.chat?.id;

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { botId: bot.id },
      include: { post: true },
      orderBy: { createdAt: 'asc' }
    });

    if (campaigns.length === 0) {
      const text = "📭 شما هیچ کمپین فعالی ندارید.";
      if (editMessageId) {
          await callTelegramAPI("editMessageText", { chat_id: chatId, message_id: editMessageId, text }, bot.token);
      } else {
          await callTelegramAPI("sendMessage", { chat_id: chatId, text }, bot.token);
      }
      return;
    }

    let text = "📋 **لیست کمپین‌های زمان‌بندی شده شما:**\n\n";
    const keyboard: any[] = [];

    campaigns.forEach((camp, index) => {
      const num = index + 1;
      const groupName = camp.chatTitle || camp.chatId;
      const statusIcon = camp.isActive ? "✅" : "⏸";
      
      let scheduleText = "";
      if (camp.scheduleType === "INTERVAL") {
          scheduleText = `هر ${camp.intervalHours} ساعت`;
      } else if (camp.scheduleType === "SPECIFIC_TIMES" && camp.specificTimes) {
          scheduleText = `ساعات [${camp.specificTimes.join(", ")}]`;
      }

      const nextRunDate = camp.nextRun 
        ? new Date(camp.nextRun).toLocaleString("fa-IR") 
        : "نامشخص";

      text += `${num}. ${statusIcon} **گروه:** ${groupName}\n`;
      text += `   📝 **پست:** ${camp.post.content?.substring(0, 15)}...\n`;
      text += `   ⏳ **تکرار:** ${scheduleText}\n`;
      text += `   🗓 **اجرای بعدی:** ${nextRunDate}\n\n`;

      // ایجاد دکمه‌ها برای هر ردیف
      keyboard.push([
        { text: `🗑 حذف ${num}`, callback_data: `del_camp_${camp.id}` },
        { text: camp.isActive ? `⏸ توقف ${num}` : `▶️ فعال‌سازی ${num}`, callback_data: `tgl_camp_${camp.id}` }
      ]);
    });

    // در صورت نیاز دکمه بستن منو
    keyboard.push([{ text: "❌ بستن لیست", callback_data: "close_menu" }]);

    if (editMessageId) {
      await callTelegramAPI("editMessageText", {
        chat_id: chatId,
        message_id: editMessageId,
        text: text,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      }, bot.token);
    } else {
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
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
