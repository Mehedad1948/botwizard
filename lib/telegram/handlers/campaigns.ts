/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleCampaignsCommand(message: any, botToken: string) {
  const telegramId = message.from.id.toString();
  const chatId = message.chat.id;

  const campaigns = await prisma.campaign.findMany({
    where: {
      post: {
        bot: {
          user: { telegramId }
        }
      }
    },
    include: {
      post: true
    }
  });

  if (!campaigns || campaigns.length === 0) {
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: "📭 شما هیچ کمپین فعالی ندارید."
    }, botToken);
    return;
  }

  for (const camp of campaigns) {
    const nextRunFa = new Date(camp.nextRun).toLocaleString('fa-IR');
    const statusText = camp.isActive ? "✅ فعال" : "⏸ متوقف شده";
    const pauseResumePrefix = camp.isActive ? "pause_camp" : "resume_camp";
    const pauseResumeLabel = camp.isActive ? "⏸ توقف" : "▶️ ادامه";

    const text = `
📢 **گروه:** ${camp.chatId}
📝 **پست:** ${camp.post.content?.substring(0, 30) || "مدیا/فایل"}...
⏳ **تکرار:** هر ${camp.intervalHours} ساعت
وضعیت: ${statusText}
🗓 **اجرای بعدی:** ${nextRunFa}
    `;

    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: pauseResumeLabel, callback_data: `${pauseResumePrefix}_${camp.id}` },
            { text: "🗑 حذف", callback_data: `del_camp_${camp.id}` }
          ]
        ]
      }
    }, botToken);
  }
}
