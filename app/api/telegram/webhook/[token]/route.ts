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

    if (!mainBotToken) {
      console.error("❌ [Config Error] Main Bot token is missing in .env");
      throw new Error("Main Bot token is missing in .env");
    }

    const update = await req.json();
    console.log(`\n📥 [Webhook Request] Token: ...${receivedToken.slice(-6)} | Update ID: ${update.update_id}`);
    console.log(`📦 [Webhook Payload]:`, JSON.stringify(update, null, 2));

    // ========== LOGIC FOR MAIN BOT ==========
    if (receivedToken === mainBotToken) {
      console.info("🤖 [Routing] Traffic directed to MAIN BOT handlers.");
      if (update.message) {
        console.info(`💬 [Main Bot] Processing message from: ${update.message.from?.id}`);
        await handleStartAndAuth(update.message, mainBotToken);
      } else {
        console.warn("⚠️ [Main Bot] Unhandled update type received.");
      }
      return NextResponse.json({ ok: true });
    }

    // ========== LOGIC FOR USER BOTS ==========
    console.info("🤖 [Routing] Traffic directed to USER BOT handlers.");
    
    const bot = await prisma.bot.findUnique({
      where: { token: receivedToken },
      include: { user: true }
    });

    if (!bot) {
      console.error(`❌ [Database Error] Bot with token ...${receivedToken.slice(-6)} not found in DB.`);
      return NextResponse.json({ ok: false, error: "Bot not found" });
    }

    console.info(`✅ [DB Match] Found bot: @${bot.username} (Owned by User ID: ${bot.userId})`);

    // Security Check
    const fromId = (update.message?.from?.id || update.callback_query?.from?.id || update.my_chat_member?.from?.id)?.toString();
    
    if (!fromId) {
      console.warn("⚠️ [Security] Could not extract 'fromId' from update. Skipping payload.");
      return NextResponse.json({ ok: true });
    }

    if (fromId !== bot.user.telegramId) {
      console.warn(`🚨 [Security Breach Attempt] Unauthorized access! Bot: @${bot.username} | Attacker Telegram ID: ${fromId} | Owner Telegram ID: ${bot.user.telegramId}`);
      return NextResponse.json({ ok: true });
    }

    // Route updates
    if (update.message) {
      const text = update.message.text;

      if (text === "/start") {
        console.info(`🔄 [User Bot Router] Executing /start command for @${bot.username}`);
        const welcomeMessage = `🎉 به ربات اختصاصی خودتان خوش آمدید!\n\nنحوه استفاده:\n۱. ابتدا این ربات را در گروه‌ها یا کانال‌های هدف خود عضو کرده و ادمین کنید.\n۲. پیام (متن، عکس، ویدیو و...) خود را همینجا برای من بفرستید.\n۳. من به شما دکمه‌های "ارسال فوری" و "زمان‌بندی" را نمایش می‌دهم.\n۴. برای مدیریت زمان‌بندی‌ها از دستور /campaigns استفاده کنید.`;

        await callTelegramAPI('sendMessage', {
          chat_id: update.message.chat.id,
          text: welcomeMessage
        }, bot.token);
      }
      else if (text && text.startsWith("/campaigns")) {
        console.info(`🔄 [User Bot Router] Executing /campaigns command for @${bot.username}`);
        await handleCampaignsCommand(update.message, bot);
      }
      else {
        console.info(`🔄 [User Bot Router] Executing handleDraftPost for @${bot.username}`);
        await handleDraftPost(update.message, bot);
      }
    }
    else if (update.my_chat_member) {
      console.info(`🔄 [User Bot Router] Processing my_chat_member (Group Addition/Removal) for @${bot.username}`);
      await handleGroupAddition(update.my_, bot);
    }
    else if (update.callback_query) {
      console.info(`🔄 [User Bot Router] Processing callback_query for @${bot.username} | Data: ${update.callback_query.data}`);
      await handleCallbackQuery(update.callback_query, bot);
    } 
    else {
      console.warn(`⚠️ [User Bot Router] Unhandled update type for @${bot.username}. N action taken.`);
    }

    console.info(`✅ [Webhook Response] Successfully processed update ${update.update_id}`);
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
