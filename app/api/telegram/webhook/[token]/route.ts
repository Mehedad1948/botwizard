// src/app/api/telegram/webhook/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleStartAndAuth } from "@/lib/telegram/handlers/auth";
import { handleDraftPost } from "@/lib/telegram/handlers/draft";
import { handleGroupAddition } from "@/lib/telegram/handlers/group";
import { handleCallbackQuery } from "@/lib/telegram/handlers/callback";
import { handleCampaignsCommand } from "@/lib/telegram/handlers/campaigns";
import { callTelegramAPI } from "@/lib/telegram/api"; 

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const receivedToken = (await params).token;
    const mainBotToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!mainBotToken) throw new Error("Main Bot token is missing in .env");

    const update = await req.json();
    console.log(`[Webhook Update for token ...${receivedToken.slice(-6)}]`, update);

    // ========== LOGIC FOR MAIN BOT ==========
    if (receivedToken === mainBotToken) {
      if (update.message) {
        await handleStartAndAuth(update.message, mainBotToken);
      }
      return NextResponse.json({ ok: true });
    }

    // ========== LOGIC FOR USER BOTS ==========
    const bot = await prisma.bot.findUnique({
      where: { token: receivedToken },
      include: { user: true }
    });

    if (!bot) {
      console.error(`[Webhook Error] Bot with token ...${receivedToken.slice(-6)} not found in DB.`);
      return NextResponse.json({ ok: false, error: "Bot not found" });
    }

    // Security Check
    const fromId = (update.message?.from?.id || update.callback_query?.from?.id)?.toString();
    if (!fromId || fromId !== bot.user.telegramId) {
      console.warn(`[Security] Unauthorized access attempt on bot @${bot.username} by user ${fromId}`);
      return NextResponse.json({ ok: true });
    }

    // Route updates
    if (update.message) {
      const text = update.message.text;

      // بررسی دستور /start برای ربات کاربر
      if (text === "/start") {
        const welcomeMessage = `🎉 به ربات اختصاصی خودتان خوش آمدید!\n\nنحوه استفاده:\n۱. ابتدا این ربات را در گروه‌ها یا کانال‌های هدف خود عضو کرده و ادمین کنید.\n۲. پیام (متن، عکس، ویدیو و...) خود را همینجا برای من بفرستید.\n۳. من به شما دکمه‌های "ارسال فوری" و "زمان‌بندی" را نمایش می‌دهم.\n۴. برای مدیریت زمان‌بندی‌ها از دستور /campaigns استفاده کنید.`;

        // ✨ اصلاح ترتیب آرگومان‌ها ✨
        await callTelegramAPI('sendMessage', {
          chat_id: update.message.chat.id,
          text: welcomeMessage
        }, bot.token);
      }
      else if (text && text.startsWith("/campaigns")) {
        await handleCampaignsCommand(update.message, bot);
      }
      else {
        await handleDraftPost(update.message, bot);
      }
    }
    else if (update.my_chat_member) {
      await handleGroupAddition(update.my_chat_member, bot);
    }
    else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
