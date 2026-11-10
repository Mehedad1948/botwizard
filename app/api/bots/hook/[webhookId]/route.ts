import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { isValidWebhookSecret } from "@/services/bots/connection";
import { dispatchBotUpdate } from "@/services/bot-platforms/dispatch-update";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params;
  const bot = await prisma.bot.findUnique({ where: { webhookId } });
  if (!bot) return NextResponse.json({ ok: false }, { status: 404 });

  if (
    !isValidWebhookSecret(
      bot,
      request.headers.get("x-telegram-bot-api-secret-token"),
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await dispatchBotUpdate(bot, await request.json());
  } catch (error) {
    // Acknowledge anyway: a non-2xx makes the platform redeliver the same
    // update in a loop, which would repeat side effects.
    console.error("[bot webhook] update failed", error);
  }
  return NextResponse.json({ ok: true });
}
