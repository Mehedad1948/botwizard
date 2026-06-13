import { randomBytes } from "node:crypto";

import prisma from "@/lib/prisma";
import type { BotPlatformValue } from "@/services/bot-platforms/config";

export function normalizeTopicSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function createCallbackKey() {
  return randomBytes(7).toString("base64url");
}

async function ownedBotId(input: {
  userId: string;
  botId: string;
  platform: BotPlatformValue;
}) {
  const bot = await prisma.bot.findFirst({
    where: {
      id: input.botId,
      userId: input.userId,
      platform: input.platform,
    },
    select: { id: true },
  });
  return bot?.id ?? null;
}

export async function createNotificationTopic(input: {
  userId: string;
  botId: string;
  platform: BotPlatformValue;
  name: string;
  description?: string | null;
}) {
  const botId = await ownedBotId(input);
  const name = input.name.trim().slice(0, 80);
  const slug = normalizeTopicSlug(name);
  if (!botId || !name || !slug) return null;

  const last = await prisma.notificationTopic.findFirst({
    where: { botId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return prisma.notificationTopic.create({
    data: {
      botId,
      name,
      slug,
      description: input.description?.trim().slice(0, 240) || null,
      callbackKey: createCallbackKey(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}

export async function updateNotificationTopic(input: {
  userId: string;
  botId: string;
  topicId: string;
  platform: BotPlatformValue;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}) {
  const botId = await ownedBotId(input);
  if (!botId) return null;
  const topic = await prisma.notificationTopic.findFirst({
    where: { id: input.topicId, botId },
    select: { id: true },
  });
  if (!topic) return null;

  const name = input.name?.trim().slice(0, 80);
  return prisma.notificationTopic.update({
    where: { id: topic.id },
    data: {
      ...(name
        ? { name, slug: normalizeTopicSlug(name) }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim().slice(0, 240) || null }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
      ...(Number.isInteger(input.sortOrder)
        ? { sortOrder: Math.max(0, input.sortOrder!) }
        : {}),
    },
  });
}

export async function deleteOrDeactivateNotificationTopic(input: {
  userId: string;
  botId: string;
  topicId: string;
  platform: BotPlatformValue;
}) {
  const botId = await ownedBotId(input);
  if (!botId) return null;
  const topic = await prisma.notificationTopic.findFirst({
    where: { id: input.topicId, botId },
    include: {
      _count: { select: { subscriptions: true, posts: true } },
    },
  });
  if (!topic) return null;

  if (topic._count.subscriptions || topic._count.posts) {
    return prisma.notificationTopic.update({
      where: { id: topic.id },
      data: { isActive: false },
    });
  }

  await prisma.notificationTopic.delete({ where: { id: topic.id } });
  return topic;
}
