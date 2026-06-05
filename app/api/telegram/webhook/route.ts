// src/app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import { handleStartAndAuth } from "@/lib/telegram/handlers/auth";
import { handleDraftPost } from "@/lib/telegram/handlers/draft";
import { handleGroupAddition } from "@/lib/telegram/handlers/group";
import { handleCallbackQuery } from "@/lib/telegram/handlers/callback";
import { handleCampaignsCommand } from "@/lib/telegram/handlers/campaigns";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

    if (!botToken) throw new Error("Bot token is missing");

    if (update.message) {
      if (update.message.contact || (update.message.text && update.message.text.startsWith("/start"))) {
        await handleStartAndAuth(update.message, botToken);
      } 
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
