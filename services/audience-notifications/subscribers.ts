import type { SubscriberStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { PrivateSubscriberIdentity } from "./types";

export async function upsertBotSubscriber(input: {
  botId: string;
  identity: PrivateSubscriberIdentity;
  source?: string;
  startParameter?: string | null;
}) {
  const now = new Date();
  return prisma.botSubscriber.upsert({
    where: {
      botId_platformUserId: {
        botId: input.botId,
        platformUserId: input.identity.platformUserId,
      },
    },
    create: {
      botId: input.botId,
      platformUserId: input.identity.platformUserId,
      privateChatId: input.identity.privateChatId,
      username: input.identity.username,
      firstName: input.identity.firstName,
      lastName: input.identity.lastName,
      languageCode: input.identity.languageCode,
      status: "ACTIVE",
      source: input.source,
      startParameter: input.startParameter,
      lastSeenAt: now,
      lastInteractionAt: now,
    },
    update: {
      privateChatId: input.identity.privateChatId,
      username: input.identity.username,
      firstName: input.identity.firstName,
      lastName: input.identity.lastName,
      languageCode: input.identity.languageCode,
      status: "ACTIVE",
      source: input.source,
      ...(input.startParameter
        ? { startParameter: input.startParameter }
        : {}),
      lastSeenAt: now,
      lastInteractionAt: now,
    },
  });
}

export async function findBotSubscriber(
  botId: string,
  platformUserId: string,
) {
  return prisma.botSubscriber.findUnique({
    where: { botId_platformUserId: { botId, platformUserId } },
  });
}

export async function setSubscriberStatus(input: {
  botId: string;
  platformUserId: string;
  status: SubscriberStatus;
}) {
  return prisma.botSubscriber.updateMany({
    where: {
      botId: input.botId,
      platformUserId: input.platformUserId,
    },
    data: {
      status: input.status,
      lastInteractionAt: new Date(),
    },
  });
}
