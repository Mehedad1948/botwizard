// src/lib/telegram/handlers/auth.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleStartAndAuth(message: any, mainBotToken: string) {
  const { text, from, chat } = message;
  const telegramId = from.id.toString();

  const guideText = `🤖 **به ربات‌ساز خوش آمدید!**

برای ساخت ربات مدیریت محتوای خودتان:

1️⃣ به @BotFather بروید و یک ربات جدید بسازید.
2️⃣ توکن API که دریافت می‌کنید را کپی کنید.
3️⃣ توکن را با دستور زیر برای من بفرستید:
\`/addbot 123456:ABC-DEF1234567890\`

پس از آن، می‌توانید تمام پیام‌ها را به ربات *خودتان* بفرستید تا آن‌ها را مدیریت و ارسال کند.`;

  if (text && text.startsWith("/start")) {
     // ثبت کاربر در دیتابیس در صورت عدم وجود
     await prisma.user.upsert({
         where: { telegramId },
         update: {},
         create: { telegramId, role: "USER" }
     });
     
     await callTelegramAPI("sendMessage", { 
         chat_id: chat.id, 
         text: guideText, 
         parse_mode: 'Markdown' 
     }, mainBotToken);
     return;
  }

  // Handle /addbot command
  if (text && text.startsWith("/addbot ")) {
    const userToken = text.split(" ")[1];

    if (!userToken) {
      await callTelegramAPI("sendMessage", { chat_id: chat.id, text: "❌ لطفاً توکن را بعد از دستور وارد کنید.", parse_mode: "Markdown" }, mainBotToken);
      return;
    }

    try {
      const botInfoRes = await fetch(`https://api.telegram.org/bot${userToken}/getMe`);
      const botInfo = await botInfoRes.json();

      if (!botInfo.ok) {
        await callTelegramAPI("sendMessage", { chat_id: chat.id, text: "❌ توکن نامعتبر است. لطفاً از @BotFather یک توکن صحیح دریافت کنید." }, mainBotToken);
        return;
      }

      const user = await prisma.user.findUnique({ where: { telegramId } });
      if (!user) throw new Error("User not registered. Should send /start first.");

      // CRITICAL STEP: Set the webhook for the user's bot
      const webhookUrl = `https://${process.env.VERCEL_URL}/api/telegram/webhook/${userToken}`;
      const setWebhookRes = await fetch(`https://api.telegram.org/bot${userToken}/setWebhook?url=${webhookUrl}`);
      const setWebhookData = await setWebhookRes.json();

      if (!setWebhookData.ok) {
        console.error("Failed to set webhook:", setWebhookData);
        throw new Error("Failed to set webhook for the new bot.");
      }

      // Save the bot to our database
      await prisma.bot.create({
        data: {
          userId: user.id,
          token: userToken,
          username: botInfo.result.username
        }
      });

      // ۱. پیام موفقیت در ربات مادر
      await callTelegramAPI("sendMessage", { 
        chat_id: chat.id, 
        text: `✅ ربات شما (@${botInfo.result.username}) با موفقیت متصل و فعال شد!\n\n**مرحله بعد:**\n1. وارد ربات خودتان شوید: @${botInfo.result.username}\n2. ربات خودتان را در گروه‌ها و کانال‌های مورد نظر ادمین کنید.\n3. هر پستی که می‌خواهید را مستقیماً برای ربات *خودتان* بفرستید.` 
      }, mainBotToken);

      // ۲. تلاش برای ارسال پیام از طرف ربات اختصاصی تازه متصل شده به کاربر
      // توجه: اگر کاربر قبلا ربات خودش را Start نکرده باشد، تلگرام جلوی این پیام را می‌گیرد (به دلیل محدودیت‌های ضد-اسپم)
      const welcomeMessageForOwnBot = `🎉 سلام! ربات شما با موفقیت به سیستم متصل شد.\n\nنحوه استفاده:\n۱. ابتدا این ربات را در گروه‌ها یا کانال‌های هدف خود عضو کرده و ادمین کنید.\n۲. پیام (متن، عکس، ویدیو و...) خود را همینجا برای من بفرستید.\n۳. من به شما دکمه‌های "ارسال فوری" و "زمان‌بندی" را نمایش می‌دهم.\n۴. برای مدیریت زمان‌بندی‌ها از دستور /campaigns استفاده کنید.`;
      
      await callTelegramAPI("sendMessage", {
        chat_id: chat.id, // آیدی تلگرام کاربر
        text: welcomeMessageForOwnBot
      }, userToken);

    } catch (error) {
      console.error("Error adding bot:", error);
      await callTelegramAPI("sendMessage", { chat_id: chat.id, text: "❌ خطایی در ثبت ربات رخ داد. ممکن است این توکن قبلا ثبت شده باشد." }, mainBotToken);
    }
  }
}
