"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformFromSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import {
  createNotificationTopic,
  deleteOrDeactivateNotificationTopic,
  updateNotificationTopic,
} from "@/services/audience-notifications/topics";

function notificationsPath(platform: PlatformSlug, botId: string) {
  return dashboardPath(platform, `bots/${botId}/notifications`);
}

async function sessionUserId() {
  const session = await getSession();
  return typeof session?.userId === "string" ? session.userId : null;
}

export async function createTopicAction(
  platform: PlatformSlug,
  botId: string,
  formData: FormData,
) {
  const userId = await sessionUserId();
  if (!userId) return { error: "ابتدا وارد حساب خود شوید." };

  try {
    const topic = await createNotificationTopic({
      userId,
      botId,
      platform: platformFromSlug(platform),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    if (!topic) return { error: "ربات یا نام موضوع معتبر نیست." };
    revalidatePath(notificationsPath(platform, botId));
    revalidatePath(dashboardPath(platform, `bots/${botId}`));
    return { success: true };
  } catch (error) {
    console.log('✅🐞', error);
    
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "موضوعی با این نام از قبل برای ربات وجود دارد." };
    }
    return { error: "ایجاد موضوع انجام نشد." };
  }
}

export async function updateTopicAction(
  platform: PlatformSlug,
  botId: string,
  topicId: string,
  formData: FormData,
) {
  const userId = await sessionUserId();
  if (!userId) return { error: "ابتدا وارد حساب خود شوید." };

  try {
    const topic = await updateNotificationTopic({
      userId,
      botId,
      topicId,
      platform: platformFromSlug(platform),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    if (!topic) return { error: "موضوع پیدا نشد یا دسترسی ندارید." };
    revalidatePath(notificationsPath(platform, botId));
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "موضوعی با این نام از قبل وجود دارد." };
    }
    return { error: "ویرایش موضوع انجام نشد." };
  }
}

export async function toggleTopicAction(
  platform: PlatformSlug,
  botId: string,
  topicId: string,
  isActive: boolean,
) {
  const userId = await sessionUserId();
  if (!userId) return { error: "ابتدا وارد حساب خود شوید." };
  const topic = await updateNotificationTopic({
    userId,
    botId,
    topicId,
    platform: platformFromSlug(platform),
    isActive,
  });
  if (!topic) return { error: "موضوع پیدا نشد یا دسترسی ندارید." };
  revalidatePath(notificationsPath(platform, botId));
  return { success: true };
}

export async function deleteTopicAction(
  platform: PlatformSlug,
  botId: string,
  topicId: string,
) {
  const userId = await sessionUserId();
  if (!userId) return { error: "ابتدا وارد حساب خود شوید." };
  const topic = await deleteOrDeactivateNotificationTopic({
    userId,
    botId,
    topicId,
    platform: platformFromSlug(platform),
  });
  if (!topic) return { error: "موضوع پیدا نشد یا دسترسی ندارید." };
  revalidatePath(notificationsPath(platform, botId));
  revalidatePath(dashboardPath(platform, `bots/${botId}`));
  return { success: true };
}

export async function updatePostTopicsAction(
  platform: PlatformSlug,
  botId: string,
  postId: string,
  formData: FormData,
) {
  const userId = await sessionUserId();
  if (!userId) return { error: "ابتدا وارد حساب خود شوید." };
  const topicIds = [...new Set(formData.getAll("topicId").map(String))];
  const ownedPost = await prisma.post.findFirst({
    where: {
      id: postId,
      botId,
      bot: {
        userId,
        platform: platformFromSlug(platform),
      },
    },
    select: { id: true },
  });
  if (!ownedPost) return { error: "پست پیدا نشد یا دسترسی ندارید." };

  const validTopics = await prisma.notificationTopic.findMany({
    where: { botId, id: { in: topicIds }, isActive: true },
    select: { id: true },
  });
  if (validTopics.length !== topicIds.length) {
    return { error: "یکی از موضوع‌ها نامعتبر یا متعلق به ربات دیگری است." };
  }

  await prisma.$transaction([
    prisma.postNotificationTopic.deleteMany({ where: { postId } }),
    ...(validTopics.length
      ? [
          prisma.postNotificationTopic.createMany({
            data: validTopics.map((topic) => ({
              postId,
              topicId: topic.id,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath(dashboardPath(platform, `bots/${botId}`));
  revalidatePath(notificationsPath(platform, botId));
  revalidatePath(dashboardPath(platform, "campaigns"));
  return { success: true };
}
