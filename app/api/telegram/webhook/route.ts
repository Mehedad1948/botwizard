// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import { handleStartAndAuth } from "@/lib/telegram/handlers/auth";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const mainBotToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!mainBotToken) throw new Error("Main Bot token is missing in .env");

    console.log(`[Main Bot Webhook Update]`, update);

    if (update.message) {
      // پاس دادن پیام به هندلر ربات مادر (آموزش، دریافت توکن، ایجاد دکمه شیشه‌ای)
      await handleStartAndAuth(update.message, mainBotToken);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ [Main Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
