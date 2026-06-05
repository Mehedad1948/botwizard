/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ==========================================
// UTILITY: TELEGRAM API CALLER
// ==========================================
async function callTelegramAPI(method: string, payload: any, token: string) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error) {
    console.error(`❌ [Telegram API Error - ${method}]:`, error);
    return null;
  }
}

// ==========================================
// MODULE 1: AUTHENTICATION & START
// ==========================================
async function handleStartAndAuth(message: any, botToken: string) {
  // ... (بدون تغییر) ...
  const { text, from, chat, contact } = message;
  const telegramId = from.id.toString();
  const appUrl = "https://botwizard-oesj.vercel.app";

  const guideText = `
🤖 **راهنمای استفاده از دستیار هوشمند:**

1️⃣ **اتصال گروه/کانال:** مرا به عنوان مدیر (Admin) به گروه یا کانال خود اضافه کنید تا بتوانم آنجا پست بگذارم.
2️⃣ **ایجاد پست:** هر عکس، متن، ویدیو یا فایلی که دارید را به همین چت خصوصی بفرستید (یا فوروارد کنید).
3️⃣ **انتشار:** به محض دریافت، به شما دکمه‌هایی می‌دهم تا آن را فوراً منتشر کنید یا در سایت برای آینده زمان‌بندی کنید.
  `;

  if (contact && contact.phone_number) {
    let phone = contact.phone_number;
    if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
    if (phone.startsWith('98')) phone = '0' + phone.slice(2);

    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
      where: { telegramId },
      data: { phone, otpCode: otp, otpExpires: expires },
    });

    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "✅ شماره شما با موفقیت تایید شد.",
      reply_markup: { remove_keyboard: true }
    }, botToken);

    const loginUrl = `${appUrl}/login?step=verify&phone=${phone}`;
    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: `کد ورود شما: ${otp}\n\n${guideText}`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 ورود سریع به پنل کاربری", url: loginUrl }]]
      }
    }, botToken);
    return;
  }

  if (text && text.startsWith("/start")) {
    const existingUser = await prisma.user.findUnique({
      where: { telegramId },
      select: { phone: true }
    });

    if (existingUser && existingUser.phone) {
      await callTelegramAPI("sendMessage", {
        chat_id: chat.id,
        text: `سلام مجدد! 👋\nشما قبلاً ثبت نام کرده‌اید.\n\n${guideText}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 ورود به پنل کاربری", url: `${appUrl}/dashboard` }],
            [{ text: "➕ ایجاد ربات جدید", url: `${appUrl}/dashboard/bots` }]
          ]
        }
      }, botToken);
      return;
    }

    await prisma.user.upsert({
      where: { telegramId },
      update: { firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
      create: { telegramId, firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
    });

    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "سلام! 👋 به دستیار هوشمند مدیریت پست خوش آمدید.\n\nبرای استفاده از امکانات ربات و ورود به پنل، لطفاً شماره موبایل خود را از طریق دکمه زیر ارسال کنید 👇",
      reply_markup: {
        keyboard: [[{ text: "📱 ارسال شماره موبایل", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }, botToken);
  }
}

// ==========================================
// MODULE 2: POST DRAFTING (Message Catcher)
// ==========================================
async function handleDraftPost(message: any, botToken: string) {
  if (message.chat.type === "private" && !message.text?.startsWith("/")) {
    const draftId = message.message_id;
    const chatId = message.chat.id;

    // TODO: Save message details to DB (Post table)

    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      reply_to_message_id: draftId,
      text: "📌 محتوای شما دریافت شد.\nچه کاری می‌خواهید انجام دهید؟",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚀 ارسال فوری", callback_data: `send_now_${draftId}` },
            { text: "📅 زمان‌بندی", callback_data: `sch_${draftId}` } // Changed callback prefix for brevity
          ],
          [{ text: "❌ لغو", callback_data: "cancel_draft" }]
        ]
      }
    }, botToken);
  }
}

// ==========================================
// MODULE 3: GROUP ADDITION (my_chat_member)
// ==========================================
async function handleGroupAddition(my_chat_member: any, botToken: string) {
  // ... (بدون تغییر) ...
  const { chat, new_chat_member, from } = my_chat_member;
  
  if (new_chat_member.status === "administrator" || new_chat_member.status === "member") {
    // TODO: Save chat.id and chat.title to DB (so we can fetch them in the scheduling step)
    await callTelegramAPI("sendMessage", {
      chat_id: from.id,
      text: `✅ ربات به **${chat.title}** متصل شد.\nحالا می‌توانید پست‌ها را زمان‌بندی کنید.`,
      parse_mode: "Markdown"
    }, botToken);
  }
}

// ==========================================
// MODULE 4: CALLBACK QUERIES (Inline Buttons)
// ==========================================
async function handleCallbackQuery(callback_query: any, botToken: string) {
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
    // Mocking the database fetch for now:
    const connectedGroups = [
      { id: "-100123456789", title: "گروه تست ۱" },
      { id: "-100987654321", title: "کانال تست ۲" }
    ];

    const keyboard = connectedGroups.map(group => (
      [{ text: `📢 ${group.title}`, callback_data: `sg_${draftId}_${group.id}` }] // sg = select group
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
      [{ text: `⏳ ${inv.label}`, callback_data: `si_${draftId}_${targetGroupId}_${inv.hours}` }] // si = select interval
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

    // TODO: Save to DB
    /* 
    await prisma.campaign.create({
      data: {
        postId: DB_POST_ID,
        chatId: targetGroupId,
        intervalHours: parseInt(intervalHours),
        nextRun: new Date(Date.now() + parseInt(intervalHours) * 3600000),
        isActive: true
      }
    });
    */

    await callTelegramAPI("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: `✅ کمپین شما با موفقیت ثبت شد.\nپست شما هر ${intervalHours} ساعت در گروه انتخاب‌شده ارسال خواهد شد.\n\nبرای مدیریت کمپین‌ها از دستور /campaigns استفاده کنید.`
    }, botToken);
  }
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

// ==========================================
// MODULE: CAMPAIGNS MANAGEMENT (/campaigns)
// ==========================================
async function handleCampaignsCommand(message: any, botToken: string) {
  const telegramId = message.from.id.toString();
  const chatId = message.chat.id;

  // واکشی کمپین‌های کاربر از دیتابیس (بر اساس ساختار Prisma شما)
  // توجه: این کوئری ممکن است نیاز به تنظیم دقیق بر اساس schema.prisma شما داشته باشد.
  const campaigns = await prisma.campaign.findMany({
    where: {
      // فرض می‌کنیم کمپین‌ها از طریق پست و بات به کاربر متصل هستند
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

  // ارسال یک پیام جداگانه برای هر کمپین به همراه دکمه‌های شیشه‌ای
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


// ==========================================
// MAIN WEBHOOK ROUTE
// ==========================================
export async function POST(req: Request) {
  try {
    const update = await req.json();
    const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!botToken) throw new Error("Bot token is missing");

    if (update.message) {
      if (update.message.contact || (update.message.text && update.message.text.startsWith("/start"))) {
        await handleStartAndAuth(update.message, botToken);
      } 
      // اضافه شدن هندلر کمپین‌ها
      else if (update.message.text && update.message.text.startsWith("/campaigns")) {
        await handleCampaignsCommand(update.message, botToken);
      } 
      else {
        await handleDraftPost(update.message, botToken);
      }
    }
    
    
    if (update.my_chat_member) {
      await handleGroupAddition(update.my_chat_member, botToken);
    }

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, botToken);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false });
  }
}
