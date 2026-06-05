/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleCallbackQuery(callback_query: any, botToken: string) {
  const data = callback_query.data;
  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;

  // 1. Cancel
  if (data === "cancel_draft") {
    await callTelegramAPI("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "❌ عملیات لغو شد."
    }, botToken);
  } 
  
  // 2. Send Now
  else if (data.startsWith("send_now_")) {
    const draftId = data.split("_")[2];
    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "⏳ در حال ارسال..."
    }, botToken);
    // TODO: Implement actual send
  }
  
  // 3. STEP ONE: Schedule Clicked -> Show Target Groups
  else if (data.startsWith("sch_")) {
    const draftId = data.split("_")[1];
    
    // TODO: Fetch user's connected groups from your Database here
    const connectedGroups = [
      { id: "-100123456789", title: "گروه تست ۱" },
      { id: "-100987654321", title: "کانال تست ۲" }
    ];

    const keyboard = connectedGroups.map(group => (
      [{ text: `📢 ${group.title}`, callback_data: `sg_${draftId}_${group.id}` }]
    ));
    keyboard.push([{ text: "🔙 بازگشت", callback_data: "cancel_draft" }]);

    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "لطفاً گروه یا کانال مقصد را انتخاب کنید:",
      reply_markup: { inline_keyboard: keyboard }
    }, botToken);
  }

  // 4. STEP ONE: Group Selected -> Show Intervals
  else if (data.startsWith("sg_")) {
    const [_, draftId, targetGroupId] = data.split("_");

    const intervals = [
      { label: "هر ۲ ساعت", hours: 2 },
      { label: "هر ۱۲ ساعت", hours: 12 },
      { label: "هر ۲۴ ساعت (روزانه)", hours: 24 },
    ];

    const keyboard = intervals.map(inv => (
      [{ text: `⏳ ${inv.label}`, callback_data: `si_${draftId}_${targetGroupId}_${inv.hours}` }]
    ));
    keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "بازه زمانی تکرار این پست را انتخاب کنید:",
      reply_markup: { inline_keyboard: keyboard }
    }, botToken);
  }

  // 5. STEP ONE: Interval Selected -> Save Campaign to DB
  else if (data.startsWith("si_")) {
    const [_, draftId, targetGroupId, intervalHours] = data.split("_");
    const intervalNum = parseInt(intervalHours);

    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: callback_query.from.id.toString() },
        include: { 
          bots: {
            include: {
              posts: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
          } 
        }
      });

      if (!user || user.bots.length === 0) throw new Error("کاربر یا رباتی یافت نشد");
      const bot = user.bots[0];
      if (bot.posts.length === 0) throw new Error("پستی یافت نشد");

      const latestPost = bot.posts[0]; 

      await prisma.campaign.create({
        data: {
          botId: bot.id,
          postId: latestPost.id, 
          chatId: targetGroupId,
          chatTitle: "گروه/کانال",
          intervalHours: intervalNum,
          isActive: true,
          nextRun: new Date(Date.now() + intervalNum * 60 * 60 * 1000), 
        }
      });

      await callTelegramAPI("editMessageText", {
        chat_id: chatId, message_id: messageId,
        text: `✅ کمپین شما با موفقیت ثبت شد.\nپست شما هر ${intervalHours} ساعت در گروه انتخاب‌شده ارسال خواهد شد.\n\nبرای مدیریت کمپین‌ها از دستور /campaigns استفاده کنید.`
      }, botToken);

    } catch (error) {
      console.error("Error creating campaign:", error);
      await callTelegramAPI("editMessageText", {
        chat_id: chatId, message_id: messageId,
        text: "❌ خطایی در ذخیره کمپین رخ داد. لطفا مجددا تلاش کنید."
      }, botToken);
    }
  }

  // 6. Pause Campaign
  else if (data.startsWith("pause_camp_")) {
    const campId = data.split("_")[2];
    await prisma.campaign.update({
      where: { id: campId },
      data: { isActive: false }
    });
    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "⏸ کمپین متوقف شد."
    }, botToken);
  }

  // 7. Resume Campaign
  else if (data.startsWith("resume_camp_")) {
    const campId = data.split("_")[2];
    await prisma.campaign.update({
      where: { id: campId },
      data: { isActive: true }
    });
    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "▶️ کمپین مجدداً فعال شد."
    }, botToken);
  }

  // 8. Delete Campaign
  else if (data.startsWith("del_camp_")) {
    const campId = data.split("_")[2];
    await prisma.campaign.delete({
      where: { id: campId }
    });
    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "🗑 کمپین با موفقیت حذف شد."
    }, botToken);
  }

  await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, botToken);
}
