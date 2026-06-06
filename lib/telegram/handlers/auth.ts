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

      // حذف اسلش اضافه از انتهای آدرس در صورت وجود
      const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
      if (!baseUrl || baseUrl === "https://undefined") {
          throw new Error("آدرس پایه سرور در فایل .env تنظیم نشده است.");
      }

      const webhookUrl = `${baseUrl}/api/telegram/webhook/${userToken}`;
      
      const setWebhookRes = await fetch(`https://api.telegram.org/bot${userToken}/setWebhook?url=${webhookUrl}`);
      const setWebhookData = await setWebhookRes.json();
      
      if (!setWebhookData.ok) {
        throw new Error("Failed to set webhook for the new bot.");
      }

      // استفاده از upsert به جای create تا اگر توکن از قبل بود، آپدیت شود و ارور ندهد
      await prisma.bot.upsert({
        where: { token: userToken },
        update: {
          userId: user.id,
          username: botInfo.result.username
        },
        create: {
          userId: user.id,
          token: userToken,
          username: botInfo.result.username
        }
      });

      // ۱. پیام موفقیت در ربات مادر
      await callTelegramAPI("sendMessage", { 
        chat_id: chat.id, 
        text: `✅ ربات شما (@${botInfo.result.username}) با موفقیت متصل و فعال شد!\n\n**مرحله بعد:**\n1. وارد ربات خودتان شوید: @${botInfo.result.username}\n2. دستور /start را بفرستید.\n3. ربات خودتان را در گروه‌ها و کانال‌های مورد نظر ادمین کنید.` 
      }, mainBotToken);

      // ۲. تلاش برای ارسال پیام از طرف ربات اختصاصی
      // این بخش باید در try-catch جداگانه باشد تا در صورت عدم استارت ربات توسط کاربر، کل فرآیند کرش نکند
      try {
        const welcomeMessageForOwnBot = `🎉 سلام! ربات شما با موفقیت به سیستم متصل شد.\n\nنحوه استفاده:\n۱. ابتدا این ربات را در گروه‌ها یا کانال‌های هدف خود عضو کرده و ادمین کنید.\n۲. پیام (متن، عکس، ویدیو و...) خود را همینجا برای من بفرستید.\n۳. من به شما دکمه‌های "ارسال فوری" و "زمان‌بندی" را نمایش می‌دهم.\n۴. برای مدیریت زمان‌بندی‌ها از دستور /campaigns استفاده کنید.`;
        
        await callTelegramAPI("sendMessage", {
          chat_id: chat.id,
          text: welcomeMessageForOwnBot
        }, userToken);
      } catch (err) {
        console.log("⚠️ کاربر هنوز ربات جدید را استارت نکرده است، پیام خوش‌آمدگویی مستقیم ارسال نشد.");
      }

    }catch (error: any) {
      console.error("Error adding bot:", error);
      
      // استخراج متن خطا
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      
      await callTelegramAPI("sendMessage", { 
        chat_id: chat.id, 
        text: `❌ خطایی در ثبت ربات رخ داد:\n\n\`${errorMessage}\``,
        parse_mode: 'Markdown'
      }, mainBotToken);
    }

  }
}
