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
  const { text, from, chat, contact } = message;
  const telegramId = from.id.toString();

  // Handle Contact Sharing
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

    // Remove keyboard
    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "✅ شماره شما با موفقیت تایید شد.",
      reply_markup: { remove_keyboard: true }
    }, botToken);

    // Send OTP and Inline Login
    const appUrl = "https://botwizard-oesj.vercel.app"; 
    const loginUrl = `${appUrl}/login?step=verify&phone=${phone}`;
    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: `کد تایید شما: ${otp}\n\nبرای ورود مستقیم روی دکمه شیشه‌ای زیر کلیک کنید 👇`,
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 ورود سریع به پنل", url: loginUrl }]]
      }
    }, botToken);
    return;
  }

  // Handle /start
  if (text && text.startsWith("/start")) {
    await prisma.user.upsert({
      where: { telegramId },
      update: { firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
      create: { telegramId, firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
    });

    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "سلام! 👋\nبرای استفاده از ربات و ورود به پنل، لطفاً شماره موبایل خود را ارسال کنید 👇",
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
  // If it's a private chat and NOT a command
  if (message.chat.type === "private" && !message.text?.startsWith("/")) {
    const draftId = message.message_id;
    const chatId = message.chat.id;

    // TODO: Save draftId (message_id) and chatId to your DB Drafts table here

    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      reply_to_message_id: draftId,
      text: "📌 محتوای شما به عنوان پیش‌نویس دریافت شد.\n\nچه کاری می‌خواهید انجام دهید؟",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚀 ارسال فوری", callback_data: `send_now_${draftId}` },
            { text: "📅 زمان‌بندی (تقویم)", callback_data: `schedule_${draftId}` }
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
  const { chat, new_chat_member, from } = my_chat_member;
  
  // Check if the bot was added (or promoted)
  if (new_chat_member.status === "administrator" || new_chat_member.status === "member") {
    console.log(`🤖 Bot added to chat: ${chat.title} (${chat.id}) by User: ${from.id}`);
    
    // TODO: Save chat.id and chat.title to your DB (e.g., TargetGroups table) linked to User(from.id)

    // Notify the user in DM that the group is connected
    await callTelegramAPI("sendMessage", {
      chat_id: from.id,
      text: `✅ ربات با موفقیت به گروه/کانال **${chat.title}** متصل شد.\nحالا می‌توانید پست‌های خود را به اینجا ارسال کنید!`,
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

  if (data === "cancel_draft") {
    await callTelegramAPI("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "❌ پیش‌نویس لغو شد."
    }, botToken);
  } 
  else if (data.startsWith("send_now_")) {
    const draftId = data.replace("send_now_", "");
    await callTelegramAPI("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "⏳ در حال آماده‌سازی برای ارسال..."
    }, botToken);
    
    // Here you would normally fetch the user's connected groups and use copyMessage
    // callTelegramAPI("copyMessage", { from_chat_id: chatId, message_id: draftId, chat_id: TARGET_GROUP_ID })
  }
  else if (data.startsWith("schedule_")) {
    await callTelegramAPI("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "📅 برای زمان‌بندی دقیق، لطفاً به پنل کاربری مراجعه کنید.",
      reply_markup: {
         inline_keyboard: [[{ text: "🌐 ورود به پنل", url: "https://botwizard-oesj.vercel.app/dashboard" }]]
      }
    }, botToken);
  }

  // Answer the callback to remove the loading state on the user's button
  await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, botToken);
}

// ==========================================
// MAIN WEBHOOK ROUTE
// ==========================================
export async function POST(req: Request) {
  try {
    const update = await req.json();
    const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!botToken) throw new Error("Bot token is missing");

    // Route 1: Normal Messages (Text, Media, Contact, /start)
    if (update.message) {
      if (update.message.contact || (update.message.text && update.message.text.startsWith("/start"))) {
        await handleStartAndAuth(update.message, botToken);
      } else {
        await handleDraftPost(update.message, botToken);
      }
    }
    
    // Route 2: Bot added to Group/Channel
    if (update.my_chat_member) {
      await handleGroupAddition(update.my_chat_member, botToken);
    }

    // Route 3: User clicked an inline button
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, botToken);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false });
  }
}
