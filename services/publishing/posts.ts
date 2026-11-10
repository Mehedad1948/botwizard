import type { Bot, MediaType, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import {
  capturePostFromMessage,
  MAX_CAPTION_LENGTH,
  MAX_TEXT_LENGTH,
  parseButtonLines,
  sendPost,
} from "./content";
import { classifyDeliveryError } from "./errors";
import type { Result } from "./campaigns";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const UPLOAD_METHODS: Record<Exclude<MediaType, "NONE">, [string, string]> = {
  IMAGE: ["sendPhoto", "photo"],
  VIDEO: ["sendVideo", "video"],
  ANIMATION: ["sendAnimation", "animation"],
  AUDIO: ["sendAudio", "audio"],
  DOCUMENT: ["sendDocument", "document"],
};

export function mediaTypeForFile(file: File): Exclude<MediaType, "NONE"> {
  const type = file.type.toLowerCase();
  if (type === "image/gif") return "ANIMATION";
  if (type.startsWith("image/")) return "IMAGE";
  if (type.startsWith("video/")) return "VIDEO";
  if (type.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

export type PostFields = {
  title: string;
  content: string;
  buttons: string;
  file: File | null;
};

function validateText(content: string, hasMedia: boolean): string | null {
  const limit = hasMedia ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
  if (!hasMedia && !content.trim()) return "متن پست یا یک فایل لازم است.";
  if (content.length > limit) {
    return hasMedia
      ? `توضیح فایل حداکثر ${limit.toLocaleString("fa-IR")} کاراکتر است.`
      : `متن پست حداکثر ${limit.toLocaleString("fa-IR")} کاراکتر است.`;
  }
  return null;
}

/**
 * Uploads media to the platform by sending it to the owner's private chat.
 * The returned file id is reusable by this bot, and the owner sees a preview.
 */
async function uploadMedia(
  bot: Pick<Bot, "token" | "platform" | "ownerPlatformUserId">,
  file: File,
  caption: string,
): Promise<Result<{ mediaType: MediaType; mediaFileId: string; sourceChatId: string; sourceMessageId: number }>> {
  if (!bot.ownerPlatformUserId) {
    return { ok: false, error: "ابتدا حساب خود را به ربات متصل کنید تا امکان بارگذاری فایل فعال شود." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "حجم فایل بیش از ۲۰ مگابایت است. فایل‌های بزرگ را مستقیم برای ربات بفرستید." };
  }

  const mediaType = mediaTypeForFile(file);
  const [method, field] = UPLOAD_METHODS[mediaType];
  const response = await getBotPlatformProvider(bot.platform).upload(
    bot.token,
    method,
    {
      chat_id: bot.ownerPlatformUserId,
      ...(caption ? { caption } : {}),
    },
    { field, blob: file, filename: file.name || "upload" },
  );

  if (!response.ok) {
    const error = classifyDeliveryError(response);
    return {
      ok: false,
      error:
        error.kind === "BLOCKED" || error.kind === "REMOVED"
          ? "ربات نمی‌تواند به شما پیام بدهد. یک‌بار ربات را باز کنید و /start را بزنید، سپس دوباره تلاش کنید."
          : `بارگذاری فایل انجام نشد: ${error.message}`,
    };
  }

  const captured = capturePostFromMessage(response.result);
  if (!captured?.mediaFileId) {
    return { ok: false, error: "پیام‌رسان شناسه فایل را برنگرداند؛ نوع فایل را بررسی کنید." };
  }
  return {
    ok: true,
    value: {
      mediaType: captured.mediaType,
      mediaFileId: captured.mediaFileId,
      sourceChatId: captured.sourceChatId,
      sourceMessageId: captured.sourceMessageId,
    },
  };
}

export async function createPost(
  bot: Pick<Bot, "id" | "token" | "platform" | "ownerPlatformUserId">,
  fields: PostFields,
): Promise<Result<{ id: string }>> {
  const file = fields.file && fields.file.size > 0 ? fields.file : null;
  const textError = validateText(fields.content, Boolean(file));
  if (textError) return { ok: false, error: textError, field: "content" };

  const buttons = parseButtonLines(fields.buttons);
  if (buttons.error) return { ok: false, error: buttons.error, field: "buttons" };

  let media: Partial<Prisma.PostUncheckedCreateInput> = {};
  if (file) {
    const uploaded = await uploadMedia(bot, file, fields.content.trim());
    if (!uploaded.ok) return { ...uploaded, field: "file" };
    media = uploaded.value;
  }

  const post = await prisma.post.create({
    data: {
      botId: bot.id,
      title: fields.title.trim() || null,
      content: fields.content.trim() || null,
      entities: [],
      buttons: buttons.buttons.length ? buttons.buttons : undefined,
      ...media,
    },
    select: { id: true },
  });
  return { ok: true, value: post };
}

export async function updatePost(
  botId: string,
  postId: string,
  fields: Omit<PostFields, "file">,
): Promise<Result<{ id: string }>> {
  const post = await prisma.post.findFirst({
    where: { id: postId, botId },
    select: { id: true, content: true, mediaFileId: true, entities: true },
  });
  if (!post) return { ok: false, error: "پست پیدا نشد." };

  const textError = validateText(fields.content, Boolean(post.mediaFileId));
  if (textError) return { ok: false, error: textError, field: "content" };
  const buttons = parseButtonLines(fields.buttons);
  if (buttons.error) return { ok: false, error: buttons.error, field: "buttons" };

  const content = fields.content.trim() || null;
  await prisma.post.update({
    where: { id: post.id },
    data: {
      title: fields.title.trim() || null,
      content,
      // Entity offsets no longer match edited text; keep them only if unchanged.
      entities:
        content === post.content && post.entities !== null
          ? (post.entities as Prisma.InputJsonValue)
          : [],
      buttons: buttons.buttons.length ? buttons.buttons : [],
    },
  });
  return { ok: true, value: { id: post.id } };
}

export async function setPostArchived(botId: string, postId: string, archived: boolean) {
  const result = await prisma.post.updateMany({
    where: { id: postId, botId },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (archived && result.count) {
    await prisma.campaign.updateMany({
      where: { postId, botId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
  }
  return result.count === 1;
}

/** Sends the post privately to the owner as a preview. */
export async function previewPostToOwner(
  bot: Pick<Bot, "id" | "token" | "platform" | "ownerPlatformUserId">,
  postId: string,
): Promise<Result<null>> {
  if (!bot.ownerPlatformUserId) {
    return { ok: false, error: "حساب مالک هنوز به ربات متصل نشده است." };
  }
  const post = await prisma.post.findFirst({ where: { id: postId, botId: bot.id } });
  if (!post) return { ok: false, error: "پست پیدا نشد." };

  const result = await sendPost(
    getBotPlatformProvider(bot.platform),
    bot.token,
    bot.ownerPlatformUserId,
    post,
  );
  if (!result.ok) return { ok: false, error: result.error.message };
  return { ok: true, value: null };
}
