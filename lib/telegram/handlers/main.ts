/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  generateLoginToken,
  hashLoginToken,
  normalizeIranianPhone,
} from "@/lib/auth";
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
  const { contact, text, from, chat } = message;
  const telegramId = from.id.toString();

  if (contact) {
    if (contact.user_id && contact.user_id.toString() !== telegramId) {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: chat.id,
          text: "❌ لطفاً فقط شماره موبایل متعلق به حساب تلگرام خودتان را با دکمه «اشتراک شماره من» ارسال کنید.",
        },
        mainBotToken
      );
      return;
    }

    const phone = normalizeIranianPhone(contact.phone_number);

    if (!phone) {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: chat.id,
          text: "❌ شماره موبایل دریافت‌شده معتبر نیست. در حال حاضر فقط شماره‌های موبایل ایران پشتیبانی می‌شوند.",
        },
        mainBotToken
      );
      return;
    }

    const [telegramUser, phoneUser] = await Promise.all([
      prisma.user.findUnique({ where: { telegramId } }),
      prisma.user.findUnique({ where: { phone } }),
    ]);

    if (
      (phoneUser && telegramUser && phoneUser.id !== telegramUser.id) ||
      (phoneUser?.telegramId && phoneUser.telegramId !== telegramId) ||
      (telegramUser?.phone && telegramUser.phone !== phone)
    ) {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: chat.id,
          text: "❌ این شماره قبلاً به حساب دیگری متصل شده است. برای بررسی حساب با پشتیبانی تماس بگیرید.",
        },
        mainBotToken
      );
      return;
    }

    const user = telegramUser
      ? await prisma.user.update({
          where: { id: telegramUser.id },
          data: {
            phone,
            firstName: from.first_name ?? telegramUser.firstName,
            lastName: from.last_name ?? telegramUser.lastName,
            username: from.username ?? telegramUser.username,
          },
        })
      : phoneUser
        ? await prisma.user.update({
            where: { id: phoneUser.id },
            data: {
              telegramId,
              firstName: from.first_name ?? phoneUser.firstName,
              lastName: from.last_name ?? phoneUser.lastName,
              username: from.username ?? phoneUser.username,
            },
          })
        : await prisma.user.create({
            data: {
              telegramId,
              phone,
              firstName: from.first_name,
              lastName: from.last_name,
              username: from.username,
            },
          });

    const rawLoginToken = generateLoginToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") ||
      "https://botwizard-oesj.vercel.app";

    await prisma.$transaction([
      prisma.loginToken.deleteMany({ where: { userId: user.id } }),
      prisma.loginToken.create({
        data: {
          userId: user.id,
          tokenHash: hashLoginToken(rawLoginToken),
          expiresAt,
        },
      }),
    ]);

    await callTelegramAPI(
      "sendMessage",
      {
        chat_id: chat.id,
        text: "✅ شماره موبایل شما با موفقیت تأیید شد.",
        reply_markup: {
          remove_keyboard: true,
        },
      },
      mainBotToken
    );

    await callTelegramAPI(
      "sendMessage",
      {
        chat_id: chat.id,
        text: "🔐 <b>ورود امن به پنل</b>\n\nدکمه زیر فقط یک‌بار و تا ۵ دقیقه قابل استفاده است.",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "ورود امن به پنل",
                url: `${baseUrl}/api/auth/telegram-link?token=${encodeURIComponent(rawLoginToken)}`,
              },
            ],
          ],
        },
      },
      mainBotToken
    );
    return;
  }

  // ۱. دستور /start (منوی اصلی با دکمه‌های شیشه‌ای)
  if (text && text.startsWith("/start")) {
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      },
      create: {
        telegramId,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
        role: "USER",
      },
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

    if (!user.phone) {
      await callTelegramAPI(
        "sendMessage",
        {
          chat_id: chat.id,
          text: "برای ورود امن به پنل، ابتدا شماره موبایل متعلق به همین حساب تلگرام را تأیید کنید.",
          reply_markup: {
            keyboard: [
              [
                {
                  text: "📱 اشتراک شماره من",
                  request_contact: true,
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
        mainBotToken
      );
    }

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
    const helpText = `📖 <b>راهنمای راه‌اندازی و مدیریت ربات</b>

این ربات، پنل اصلی شما برای ثبت و مدیریت ربات‌های ارسال خودکار است.

<b>۱. ساخت ربات در تلگرام</b>
وارد @BotFather شوید، دستور <code>/newbot</code> را ارسال کنید و مراحل ساخت ربات را تکمیل کنید. در پایان، توکن ربات را کپی کنید.

<b>۲. اتصال ربات به سامانه</b>
روی دکمه «➕ افزودن ربات جدید» بزنید و توکن دریافتی را بدون متن اضافی ارسال کنید.

<b>۳. فعال‌سازی ربات شخصی</b>
پس از ثبت موفق، وارد ربات ساخته‌شده شوید و دستور <code>/start</code> را ارسال کنید تا پنل مدیریت آن نمایش داده شود.

<b>۴. اتصال گروه یا کانال</b>
ربات شخصی را به گروه یا کانال مقصد اضافه کرده و دسترسی ادمین، به‌ویژه مجوز ارسال پیام، را فعال کنید.

<b>۵. ارسال و زمان‌بندی محتوا</b>
در ربات شخصی خود، متن، عکس یا ویدیو را ارسال کنید؛ سپس مقصدها و روش ارسال فوری، دوره‌ای یا ساعت مشخص را انتخاب کنید.

<b>مدیریت ربات‌ها</b>
از بخش «🤖 مدیریت ربات‌های من» می‌توانید وضعیت ربات‌ها و کمپین‌های فعال را مشاهده و مدیریت کنید.

🔐 <b>نکته امنیتی:</b> توکن ربات مانند رمز عبور است. آن را در اختیار افراد دیگر قرار ندهید.`;
    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: helpText,
      parse_mode: "HTML"
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
