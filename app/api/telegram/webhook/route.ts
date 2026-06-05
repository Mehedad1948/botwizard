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
        
        let phone = contact.phone_number;
        if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
        if (phone.startsWith('98')) phone = '0' + phone.slice(2);

        // 1. Generate OTP
        const otp = Math.floor(10000 + Math.random() * 90000).toString();
        const expires = new Date(Date.now() + 5 * 60 * 1000);

        try {
          // 2. Save phone AND the new OTP
          await prisma.user.update({
            where: { telegramId },
            data: { 
              phone: phone,
              otpCode: otp,
              otpExpires: expires
            },
          });
          console.log(`✅ [DB] Phone and OTP updated for ${telegramId}`);

          if (botToken) {
            // Message 1: Remove the contact keyboard
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chat.id,
                text: "✅ شماره شما با موفقیت تایید شد.",
                reply_markup: { remove_keyboard: true }
              }),
            });

            // Message 2: Send OTP and Inline Login Button
            // Adjust the domain to match your actual frontend URL (e.g., /login or /auth)
            const appUrl = "https://botwizard-oesj.vercel.app"; 
            const loginUrl = `${appUrl}/login?step=verify&phone=${phone}`;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chat.id,
                text: `کد تایید شما: ${otp}\n\nبرای ورود مستقیم روی دکمه زیر کلیک کنید 👇`,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🌐 ورود به سایت", url: loginUrl }]
                  ]
                }
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
