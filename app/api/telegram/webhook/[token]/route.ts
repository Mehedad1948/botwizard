/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/telegram/webhook/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleMainBotMessage, handleMainBotCallback } from "@/lib/telegram/handlers/main"; // آپدیت شد
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

    // ========== LOGIC FOR MAIN BOT ==========
    if (receivedToken === mainBotToken) {
      if (update.message) {
        await handleMainBotMessage(update.message, mainBotToken);
      } else if (update.callback_query) {
        await handleMainBotCallback(update.callback_query, mainBotToken);
      }
      return NextResponse.json({ ok: true });
    }

    // ========== LOGIC FOR USER BOTS ==========
    const bot = await prisma.bot.findUnique({
      where: { token: receivedToken },
      include: { user: true }
    });

    if (!bot) return NextResponse.json({ ok: false, error: "Bot not found" });

    // جلوگیری از کار کردن ربات در صورت غیرفعال بودن (Deactivated) توسط مادر
    // نکته: نیاز به فیلد isActive در دیتابیس (Prisma Schema) برای مدل Bot دارید.
    if ((bot as any).isActive === false) { 
        return NextResponse.json({ ok: true }); // Ignore quietly
    }

    const fromId = (update.message?.from?.id || update.callback_query?.from?.id || update.my_chat_member?.from?.id)?.toString();
    if (!fromId || fromId !== bot.user.telegramId) return NextResponse.json({ ok: true });

    // Route updates for User Bots
    if (update.message) {
      const text = update.message.text;
      if (text === "/start") {
        const welcomeMessage = `🎉 به ربات اختصاصی خودتان خوش آمدید!\n...`; // پیام خودتان
        await callTelegramAPI('sendMessage', { chat_id: update.message.chat.id, text: welcomeMessage }, bot.token);
      } else if (text && text.startsWith("/campaigns")) {
        await handleCampaignsCommand(update.message, bot);
      } else {
        await handleDraftPost(update.message, bot);
      }
    } else if (update.my_chat_member) {
      await handleGroupAddition(update.my_chat_member, bot);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot);
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("❌ [Webhook Fatal Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
