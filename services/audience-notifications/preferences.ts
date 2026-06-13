import prisma from "@/lib/prisma";

export async function listSubscriberTopics(
  botId: string,
  platformUserId: string,
) {
  const [subscriber, topics] = await Promise.all([
    prisma.botSubscriber.findUnique({
      where: { botId_platformUserId: { botId, platformUserId } },
      select: {
        id: true,
        status: true,
        subscriptions: {
          select: { topicId: true, isEnabled: true },
        },
      },
    }),
    prisma.notificationTopic.findMany({
      where: { botId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        callbackKey: true,
      },
    }),
  ]);

  const enabled = new Set(
    subscriber?.subscriptions
      .filter((item) => item.isEnabled)
      .map((item) => item.topicId) ?? [],
  );

  return {
    subscriber,
    topics: topics.map((topic) => ({
      ...topic,
      isEnabled: enabled.has(topic.id),
    })),
  };
}

export async function toggleSubscriberTopic(input: {
  botId: string;
  platformUserId: string;
  callbackKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    const subscriber = await tx.botSubscriber.findUnique({
      where: {
        botId_platformUserId: {
          botId: input.botId,
          platformUserId: input.platformUserId,
        },
      },
      select: { id: true, status: true },
    });
    if (!subscriber) return null;

    const topic = await tx.notificationTopic.findFirst({
      where: {
        botId: input.botId,
        callbackKey: input.callbackKey,
        isActive: true,
      },
      select: { id: true },
    });
    if (!topic) return null;

    const current = await tx.subscriberTopicSubscription.findUnique({
      where: {
        subscriberId_topicId: {
          subscriberId: subscriber.id,
          topicId: topic.id,
        },
      },
      select: { isEnabled: true },
    });
    const isEnabled = !(current?.isEnabled ?? false);

    await tx.subscriberTopicSubscription.upsert({
      where: {
        subscriberId_topicId: {
          subscriberId: subscriber.id,
          topicId: topic.id,
        },
      },
      create: {
        subscriberId: subscriber.id,
        topicId: topic.id,
        isEnabled,
      },
      update: { isEnabled },
    });

    if (subscriber.status !== "ACTIVE" && isEnabled) {
      await tx.botSubscriber.update({
        where: { id: subscriber.id },
        data: {
          status: "ACTIVE",
          lastInteractionAt: new Date(),
        },
      });
    }

    return { topicId: topic.id, isEnabled };
  });
}
