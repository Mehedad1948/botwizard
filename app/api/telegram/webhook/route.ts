// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    console.log("🟢 [Webhook Received]:", JSON.stringify(update, null, 2));

    // Check if it's a message
    if (update.message && update.message.text) {
      const { text, from, chat } = update.message;
      console.log(`💬 [Message Text]: ${text} from ${from.id}`);

      // Handle /start command
      if (text.startsWith("/start")) {
        const telegramId = from.id.toString();

        // 1. Try to save to database
        try {
          console.log("💾 [DB] Attempting to upsert user...");
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
          console.log("✅ [DB] User upserted successfully.");
        } catch (dbError) {
          console.error("❌ [DB Error]:", dbError);
          // Note: If you get an error here, check if telegramId is marked as @unique in your schema.prisma
          // and ensure there are no required fields (like phone) missing in this create block.
        }

        // 2. Try to send message back
        const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
        
        if (!botToken) {
          console.error("❌ [Env Error]: TELEGRAM_LOGIN_BOT_TOKEN is missing in Vercel!");
        } else {
          console.log("🚀 [Telegram] Sending reply...");
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chat.id,
              text: "✅ You are now authenticated! Return to the website.",
            }),
          });
          
          const responseData = await response.json();
          console.log("📥 [Telegram Response]:", responseData);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false });
  }
}
