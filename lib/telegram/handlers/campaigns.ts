/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleCampaignsCommand(message: any, botToken: string) {
  const chatId = message.chat.id;
  const telegramId = message.from.id.toString();

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        bots: {
          include: {
            campaigns: {
              include: { post: true }
            }
          }
        }
      }
    });

    if (!user || user.bots.length === 0 || user.bots[0].campaigns.length === 0) {
      await callTelegramAPI("sendMessage", {
        chat_id: chatId,
        text: "📭 شما هیچ کمپین فعالی ندارید."
      }, botToken);
      return;
    }

    const campaigns = user.bots[0].campaigns;

    for (const camp of campaigns) {
      // استفاده مستقیم از chatTitle دیتابیس به جای ریکوئست به تلگرام
      const groupName = camp.chatTitle || camp.chatId;

      const statusText = camp.isActive ? "✅ فعال" : "⏸ متوقف شده";
      
      // تغییر nextRunAt به nextRun (مطابق با اسکیما)
      const nextRunDate = camp.nextRun 
        ? new Date(camp.nextRun).toLocaleString("fa-IR") 
        : "نامشخص";

      const text = `📢 گروه: ${groupName}\n📝 پست: ${camp.post.content?.substring(0, 20)}...\n⏳ تکرار: هر ${camp.intervalHours} ساعت\nوضعیت: ${statusText}\n🗓 اجرای بعدی: ${nextRunDate}`;

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
      }, botToken);
    }
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: "❌ خطایی در دریافت لیست کمپین‌ها رخ داد."
    }, botToken);
  }
}
