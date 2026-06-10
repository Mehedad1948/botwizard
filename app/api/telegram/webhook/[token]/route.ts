import { NextResponse } from "next/server";

import {
  handleMainBotCallback,
  handleMainBotMessage,
} from "@/lib/telegram/handlers/main";
import { dispatchUserBotUpdate } from "@/services/bot-platforms/dispatch-update";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const mainBotToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    if (!mainBotToken) {
      throw new Error("Main Bot token is missing in .env");
    }

    const update = await request.json();
    if (token === mainBotToken) {
      if (update.message) {
        await handleMainBotMessage(update.message, mainBotToken);
      } else if (update.callback_query) {
        await handleMainBotCallback(update.callback_query, mainBotToken);
      }
      return NextResponse.json({ ok: true });
    }

    const result = await dispatchUserBotUpdate("TELEGRAM", token, update);
    return NextResponse.json(
      result.ok ? { ok: true } : { ok: false, error: result.error },
      { status: result.status },
    );
  } catch (error) {
    console.error("[Legacy Telegram Webhook Fatal Error]", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
