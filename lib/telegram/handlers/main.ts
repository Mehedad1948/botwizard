/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

// تابعی برای پردازش و ثبت توکن (برای جلوگیری از تکرار کد)
async function processNewBotToken(chatId: string, telegramId: string, userToken: string, mainBotToken: string) {
  // ارسال پیام انتظار
  const loadingMsgRes = await callTelegramAPI("sendMessage", { chat_id: chatId, text: "⏳ در حال بررسی و اتصال به تلگرام..." }, mainBotToken);
  const loadingMsgId = loadingMsgRes?.result?.message_id;

  try {
    const botInfoRes = await fetch(`https://api.telegram.org/bot${userToken}/getMe`);
    const botInfo = await botInfoRes.json();
    if (!botInfo.ok) throw new Error("توکن نامعتبر است. لطفاً توکن صحیح را کپی و ارسال کنید.");

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) throw new Error("ابتدا دستور /start را ارسال کنید.");

    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") || "https://botwizard-oesj.vercel.app";
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${userToken}`;
    
    const setWebhookRes = await fetch(`https://api.telegram.org/bot${userToken}/setWebhook?url=${webhookUrl}`);
    const setWebhookData = await setWebhookRes.json();
    if (!setWebhookData.ok) throw new Error("خطا در تنظیم وب‌هوک در سرور تلگرام.");

    await prisma.bot.upsert({
      where: { token: userToken },
      update: { userId: user.id, username: botInfo.result.username, isActive: true },
      create: { userId: user.id, token: userToken, username: botInfo.result.username, isActive: true }
    });

    const successText = `✅ **ربات شما (@${botInfo.result.username}) با موفقیت متصل شد!**\n\nمراحل بعدی:\n۱. وارد ربات خودتان شوید.\n۲. دستور /start را ارسال کنید.\n۳. ربات را در گروه‌های هدف خود ادمین کنید.`;
    
    if (loadingMsgId) {
      await callTelegramAPI("editMessageText", { chat_id: chatId, message_id: loadingMsgId, text: successText, parse_mode: 'Markdown' }, mainBotToken);
    } else {
      await callTelegramAPI("sendMessage", { chat_id: chatId, text: successText, parse_mode: 'Markdown' }, mainBotToken);
    }

  } catch (error: any) {
    const errText = `❌ خطا در ثبت ربات:\n\`${error.message}\``;
    if (loadingMsgId) {
      await callTelegramAPI("editMessageText", { chat_id: chatId, message_id: loadingMsgId, text: errText, parse_mode: 'Markdown' }, mainBotToken);
    } else {
      await callTelegramAPI("sendMessage", { chat_id: chatId, text: errText, parse_mode: 'Markdown' }, mainBotToken);
    }
  }
}

// --- مدیریت پیام‌های متنی ربات مادر ---
export async function handleMainBotMessage(message: any, mainBotToken: string) {
  const { text, from, chat } = message;
  const telegramId = from.id.toString();

  // ۱. دستور /start (منوی اصلی با دکمه‌های شیشه‌ای)
  if (text && text.startsWith("/start")) {
    await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId, role: "USER" }
    });

    const guideText = `🤖 **به ربات‌ساز هوشمند خوش آمدید!**\n\nبرای شروع، از طریق دکمه‌های زیر اقدام کنید:`;
    await callTelegramAPI("sendMessage", { 
      chat_id: chat.id, 
      text: guideText, 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ افزودن ربات جدید", callback_data: "main_prompt_addbot" }],
          [{ text: "🤖 مدیریت ربات‌های من", callback_data: "main_mybots" }],
            [{ text: "📖 آموزش استفاده", callback_data: "main_help" }] 
        ]
      }
    }, mainBotToken);
    return;
  }

  

  // ۲. تشخیص خودکار توکن (بهترین UX)
  // اگر متن ارسال شده فرمت توکن تلگرام را داشته باشد (مثلا 123456789:ABCDefgh...)
  const tokenRegex = /^\d{8,12}:[a-zA-Z0-9_-]{30,}$/;
  if (text && tokenRegex.test(text.trim())) {
    const userToken = text.trim();
    await processNewBotToken(chat.id, telegramId, userToken, mainBotToken);
    return;
  }

  // پشتیبانی از دستور قدیمی در صورت استفاده کاربر
  if (text && text.startsWith("/addbot ")) {
    const userToken = text.split(" ")[1];
    if (userToken) await processNewBotToken(chat.id, telegramId, userToken, mainBotToken);
    return;
  }
}

// --- مدیریت کال‌بک‌ها (دکمه‌های شیشه‌ای) ربات مادر ---
export async function handleMainBotCallback(callback_query: any, mainBotToken: string) {
  const data = callback_query.data;
  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;
  const telegramId = callback_query.from.id.toString();

  // پاسخ به دکمه "افزودن ربات جدید"
  if (data === "main_prompt_addbot") {
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: "🔑 **لطفاً توکنی که از @BotFather دریافت کرده‌اید را کپی کرده و همینجا (بدون هیچ کلمه اضافه‌ای) Paste کنید:**\n\nمثال:\n`1234567890:ABC-DEF1234567890abcdef`",
      parse_mode: 'Markdown',
      reply_markup: { force_reply: true } // این ویژگی باعث می‌شود کیبورد کاربر برای ریپلای باز شود
    }, mainBotToken);
    await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, mainBotToken);
    return;
  }

    if (data === "main_help") {
    const helpText = `📖 **راهنمای استفاده از ربات‌ساز:**\n\n۱. ابتدا یک ربات در @BotFather بسازید و توکن آن را کپی کنید.\n۲. روی «➕ افزودن ربات جدید» کلیک کرده و توکن را بفرستید.\n۳. پس از ثبت موفق، وارد ربات خود شوید و /start را بزنید.\n۴. ربات خود را در گروه‌های مورد نظرتان ادمین کنید.\n۵. در ربات خودتان، متن یا مدیا را ارسال کرده و به راحتی زمان‌بندی کنید.`;
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: helpText,
      parse_mode: 'Markdown'
    }, mainBotToken);
    await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, mainBotToken);
    return;
  }

  // پاسخ به دکمه "مدیریت ربات‌های من"
  if (data === "main_mybots") {
    const user = await prisma.user.findUnique({ where: { telegramId }, include: { bots: true } });
    if (!user || user.bots.length === 0) {
      await callTelegramAPI("sendMessage", { chat_id: chatId, text: "📭 شما هیچ ربات ثبت شده‌ای ندارید." }, mainBotToken);
      await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, mainBotToken);
      return;
    }

    const keyboard = user.bots.map(bot => ([
      { text: `🤖 @${bot.username} ${bot.isActive ? "✅" : "❌"}`, callback_data: `main_botmenu_${bot.id}` }
    ]));

    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: "لیست ربات‌های شما:\n(برای مدیریت روی آن‌ها کلیک کنید)",
      reply_markup: { inline_keyboard: keyboard }
    }, mainBotToken);
    return;
  }

  // باز کردن منوی یک ربات
  if (data.startsWith("main_botmenu_")) {
    const botId = data.replace("main_botmenu_", "");
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return;

    const keyboard = [
      [{ text: bot.isActive ? "🔴 غیرفعال کردن ربات" : "🟢 فعال کردن ربات", callback_data: `main_tglbot_${bot.id}` }],
      [{ text: "📊 مشاهده کمپین‌های فعال", callback_data: `main_botcamps_${bot.id}` }],
      [{ text: "🔙 بازگشت به لیست ربات‌ها", callback_data: `main_mybots` }]
    ];

    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: `مدیریت ربات: @${bot.username}\nوضعیت: ${bot.isActive ? "فعال ✅" : "غیرفعال ❌"}`,
      reply_markup: { inline_keyboard: keyboard }
    }, mainBotToken);
  }

  // تغییر وضعیت (فعال/غیرفعال) ربات
  if (data.startsWith("main_tglbot_")) {
    const botId = data.replace("main_tglbot_", "");
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (bot) {
      await prisma.bot.update({ where: { id: botId }, data: { isActive: !bot.isActive } });
      
      const updatedBot = await prisma.bot.findUnique({ where: { id: botId } });
      const keyboard = [
        [{ text: updatedBot?.isActive ? "🔴 غیرفعال کردن ربات" : "🟢 فعال کردن ربات", callback_data: `main_tglbot_${bot.id}` }],
        [{ text: "📊 مشاهده کمپین‌های فعال", callback_data: `main_botcamps_${bot.id}` }],
        [{ text: "🔙 بازگشت به لیست ربات‌ها", callback_data: `main_mybots` }]
      ];
      await callTelegramAPI("editMessageText", {
        chat_id: chatId, message_id: messageId,
        text: `مدیریت ربات: @${updatedBot?.username}\nوضعیت: ${updatedBot?.isActive ? "فعال ✅" : "غیرفعال ❌"}`,
        reply_markup: { inline_keyboard: keyboard }
      }, mainBotToken);
    }
  }

  // مشاهده کمپین‌های یک ربات خاص
  if (data.startsWith("main_botcamps_")) {
    const botId = data.replace("main_botcamps_", "");
    const campaigns = await prisma.campaign.findMany({ where: { botId, isActive: true } });
    
    let text = `تعداد کمپین‌های فعال این ربات: ${campaigns.length}\n\n`;
    campaigns.forEach((c, idx) => { text += `${idx + 1}. گروه: ${c.chatTitle || 'ناشناس'} | هر ${c.intervalHours} ساعت\n`; });

    const keyboard = [[{ text: "🔙 بازگشت به منوی ربات", callback_data: `main_botmenu_${botId}` }]];
    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: keyboard }
    }, mainBotToken);
  }
}
