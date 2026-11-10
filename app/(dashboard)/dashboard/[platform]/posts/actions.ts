"use server";

import { revalidatePath } from "next/cache";

import {
  dashboardPath,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { findActionBot } from "@/services/dashboard/access";
import {
  createPost,
  previewPostToOwner,
  setPostArchived,
  updatePost,
} from "@/services/publishing/posts";

function revalidatePostPages(platform: PlatformSlug, botId: string) {
  revalidatePath(dashboardPath(platform));
  revalidatePath(dashboardPath(platform, "posts"));
  revalidatePath(dashboardPath(platform, "campaigns"));
  revalidatePath(dashboardPath(platform, `bots/${botId}`));
}

function readFields(formData: FormData) {
  const file = formData.get("file");
  return {
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
    buttons: String(formData.get("buttons") ?? ""),
    file: file instanceof File && file.size > 0 ? file : null,
  };
}

export async function createPostAction(
  platform: PlatformSlug,
  formData: FormData,
): Promise<{ success?: boolean; error?: string; postId?: string; botId?: string }> {
  const bot = await findActionBot(platform, String(formData.get("botId") ?? ""));
  if (!bot) return { error: "ربات انتخاب‌شده پیدا نشد." };

  const result = await createPost(bot, readFields(formData));
  if (!result.ok) return { error: result.error };

  revalidatePostPages(platform, bot.id);
  return { success: true, postId: result.value.id, botId: bot.id };
}

export async function updatePostAction(
  platform: PlatformSlug,
  botId: string,
  postId: string,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات پیدا نشد یا به آن دسترسی ندارید." };

  const result = await updatePost(bot.id, postId, readFields(formData));
  if (!result.ok) return { error: result.error };

  revalidatePostPages(platform, bot.id);
  return { success: true };
}

export async function setPostArchivedAction(
  platform: PlatformSlug,
  botId: string,
  postId: string,
  archived: boolean,
) {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات پیدا نشد یا به آن دسترسی ندارید." };
  if (!(await setPostArchived(bot.id, postId, archived))) {
    return { error: "پست پیدا نشد." };
  }
  revalidatePostPages(platform, bot.id);
  return { success: true };
}

export async function previewPostAction(
  platform: PlatformSlug,
  botId: string,
  postId: string,
) {
  const bot = await findActionBot(platform, botId);
  if (!bot) return { error: "ربات پیدا نشد یا به آن دسترسی ندارید." };
  const result = await previewPostToOwner(bot, postId);
  return result.ok ? { success: true } : { error: result.error };
}
