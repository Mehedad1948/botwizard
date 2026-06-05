// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    console.log("🟢 [Webhook Received]:", JSON.stringify(update, null, 2));

    if (update.message) {
      const { text, from, chat, contact } = update.message;
      const telegramId = from.id.toString();
      const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

      // ==========================================
      // 1. HANDLE CONTACT SHARING (PHONE NUMBER)
      // ==========================================
      if (contact && contact.phone_number) {
        console.log(`📱 [Contact Received]: ${contact.phone_number}`);
        
        // Normalize phone number to match Iran format (e.g., 0912...)
        let phone = contact.phone_number;
        if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
        if (phone.startsWith('98')) phone = '0' + phone.slice(2);

        try {
          await prisma.user.update({
            where: { telegramId },
            data: { phone: phone },
          });
          console.log(`✅ [DB] Phone number updated for ${telegramId}`);

          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chat.id,
                text: "✅ شماره شما با موفقیت ثبت شد. حالا می‌توانید در سایت وارد شوید.",
                reply_markup: { remove_keyboard: true }
              }),
            });
          }
        } catch (error) {
          console.error("❌ [DB Error saving phone]:", error);
        }
        return NextResponse.json({ ok: true });
      }

      // ==========================================
      // 2. HANDLE /start COMMAND
      // ==========================================
      if (text && text.startsWith("/start")) {
        console.log(`💬 [Message Text]: /start from ${telegramId}`);

        try {
          await prisma.user.upsert({
            where: { telegramId },
            update: {
              firstName: from.first_name || "",
              lastName: from.last_name || null,
              username: from.username || null,
            },
            create: {
              telegramId,
              firstName: from.first_name || "",
              lastName: from.last_name || null,
              username: from.username || null,
            },
          });
        } catch (dbError) {
          console.error("❌ [DB Error]:", dbError);
        }

        if (botToken) {
          console.log("🚀 [Telegram] Sending contact request keyboard...");
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chat.id,
              text: "لطفاً برای ورود به سایت، شماره موبایل خود را با استفاده از دکمه زیر به اشتراک بگذارید 👇",
              reply_markup: {
                keyboard: [
                  [{ text: "📱 ارسال شماره موبایل", request_contact: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            }),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false });
  }
}
