// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import { handleMainBotMessage, handleMainBotCallback } from "@/lib/telegram/handlers/main";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const mainBotToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!mainBotToken) throw new Error("Main Bot token is missing in .env");

    // ۱. پردازش پیام‌های متنی ربات مادر
    if (update.message) {
      await handleMainBotMessage(update.message, mainBotToken);
    }
    
    // ۲. پردازش کلیک روی دکمه‌های شیشه‌ای (Callback Queries) ربات مادر
    if (update.callback_query) {
      await handleMainBotCallback(update.callback_query, mainBotToken);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Main Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
