import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

const TTL_MS = 24 * 60 * 60_000;

export type PublishState = {
  postId: string;
  mode: "now" | "schedule";
  /** Destination ids in display order; callbacks reference them by index. */
  options: string[];
  selected: string[];
  page: number;
  awaiting: "times" | "once" | null;
  schedule:
    | { kind: "DAILY"; times: string[] }
    | { kind: "INTERVAL"; minutes: number }
    | { kind: "ONCE"; at: string }
    | null;
};

export type Conversation<T> = { id: string; data: T };

export async function createConversation<T extends object>(
  botId: string,
  chatId: string,
  kind: string,
  data: T,
): Promise<Conversation<T>> {
  const id = randomBytes(6).toString("base64url");
  await prisma.bot.update({
    where: { id: botId },
    data: {
      conversations: {
        create: {
          id,
          chatId,
          kind,
          data: data as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
        // Opportunistic cleanup keeps the table small without a cron job.
        deleteMany: { expiresAt: { lt: new Date() } },
      },
    },
  });
  return { id, data };
}

export async function getConversation<T>(
  botId: string,
  chatId: string,
  id: string,
  kind: string,
): Promise<Conversation<T> | null> {
  const row = await prisma.botConversation.findFirst({
    where: { id, botId, chatId, kind, expiresAt: { gt: new Date() } },
  });
  return row ? { id: row.id, data: row.data as T } : null;
}

export async function saveConversation<T extends object>(
  botId: string,
  conversation: Conversation<T>,
) {
  await prisma.botConversation.updateMany({
    where: { id: conversation.id, botId },
    data: {
      data: conversation.data as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
}

export async function endConversation(botId: string, id: string) {
  await prisma.botConversation.deleteMany({ where: { id, botId } });
}

/** Latest conversation in this chat that is waiting for a typed answer. */
export async function findAwaitingPublish(
  botId: string,
  chatId: string,
): Promise<Conversation<PublishState> | null> {
  const rows = await prisma.botConversation.findMany({
    where: { botId, chatId, kind: "publish", expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const row = rows.find((item) => (item.data as PublishState).awaiting);
  return row ? { id: row.id, data: row.data as PublishState } : null;
}

export async function clearAwaiting(botId: string, chatId: string) {
  const awaiting = await findAwaitingPublish(botId, chatId);
  if (!awaiting) return false;
  awaiting.data.awaiting = null;
  await saveConversation(botId, awaiting);
  return true;
}
