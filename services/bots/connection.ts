import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Bot } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";

export function appBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("آدرس عمومی سامانه (NEXT_PUBLIC_APP_BASE_URL) تنظیم نشده است.");
  }
  return baseUrl;
}

export function webhookUrl(webhookId: string) {
  return `${appBaseUrl()}/api/bots/hook/${webhookId}`;
}

function randomToken(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

export function newWebhookCredentials() {
  return { webhookId: randomToken(18), webhookSecret: randomToken(32) };
}

/** Constant-time check of Telegram's X-Telegram-Bot-Api-Secret-Token header. */
export function isValidWebhookSecret(
  bot: Pick<Bot, "platform" | "webhookSecret">,
  header: string | null,
) {
  if (bot.platform !== "TELEGRAM" || !bot.webhookSecret) return true;
  if (!header) return false;
  const expected = Buffer.from(bot.webhookSecret);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * (Re)registers the bot webhook on its opaque URL. Rotates credentials so a
 * token leaked through an old URL stops working.
 */
export async function registerWebhook(bot: Pick<Bot, "id" | "token" | "platform">) {
  const credentials = newWebhookCredentials();
  await getBotPlatformProvider(bot.platform).setWebhook(
    bot.token,
    webhookUrl(credentials.webhookId),
    { secretToken: credentials.webhookSecret },
  );
  await prisma.bot.update({ where: { id: bot.id }, data: credentials });
  return credentials;
}

export type ConnectionStatus = {
  ok: boolean;
  usesCurrentUrl: boolean;
  pendingUpdates: number;
  lastError: string | null;
  lastErrorAt: Date | null;
};

type WebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
  last_error_date?: number;
};

export async function getConnectionStatus(
  bot: Pick<Bot, "token" | "platform" | "webhookId">,
): Promise<ConnectionStatus | null> {
  // Rendered inline on the bot page, so never wait long for it.
  const response = await Promise.race([
    getBotPlatformProvider(bot.platform).call<WebhookInfo>(bot.token, "getWebhookInfo"),
    new Promise<{ ok: false; result?: undefined }>((resolve) =>
      setTimeout(() => resolve({ ok: false }), 4_000),
    ),
  ]);
  if (!response.ok || !response.result) return null;

  const info = response.result;
  let usesCurrentUrl = false;
  try {
    usesCurrentUrl = Boolean(bot.webhookId) && info.url === webhookUrl(bot.webhookId!);
  } catch {
    usesCurrentUrl = false;
  }
  const lastErrorAt = info.last_error_date ? new Date(info.last_error_date * 1000) : null;
  const recentError =
    lastErrorAt && Date.now() - lastErrorAt.getTime() < 60 * 60_000
      ? info.last_error_message ?? null
      : null;

  return {
    ok: Boolean(info.url) && usesCurrentUrl && !recentError,
    usesCurrentUrl,
    pendingUpdates: info.pending_update_count ?? 0,
    lastError: recentError,
    lastErrorAt,
  };
}
