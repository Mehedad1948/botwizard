/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BotPlatform, MediaType, Prisma } from "@prisma/client";

import type { BotPlatformProvider } from "@/services/bot-platforms/provider";
import {
  classifyDeliveryError,
  type ClassifiedDeliveryError,
} from "./errors";

export const MAX_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;
export const MAX_BUTTON_ROWS = 8;

export type UrlButton = { text: string; url: string };

export type SendablePost = {
  content: string | null;
  entities: Prisma.JsonValue | null;
  mediaType: MediaType;
  mediaFileId: string | null;
  buttons: Prisma.JsonValue | null;
  sourceChatId: string | null;
  sourceMessageId: number | null;
};

export type CapturedPost = {
  content: string | null;
  entities: Prisma.InputJsonValue;
  mediaType: MediaType;
  mediaFileId: string | null;
  sourceChatId: string;
  sourceMessageId: number;
};

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: ClassifiedDeliveryError };

const MEDIA_METHODS: Record<Exclude<MediaType, "NONE">, [string, string]> = {
  IMAGE: ["sendPhoto", "photo"],
  VIDEO: ["sendVideo", "video"],
  DOCUMENT: ["sendDocument", "document"],
  ANIMATION: ["sendAnimation", "animation"],
  AUDIO: ["sendAudio", "audio"],
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  NONE: "متن",
  IMAGE: "تصویر",
  VIDEO: "ویدیو",
  DOCUMENT: "فایل",
  ANIMATION: "گیف",
  AUDIO: "صوت",
};

export function parseButtons(value: Prisma.JsonValue | null): UrlButton[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Array.isArray)
    .map((row) =>
      (row as unknown[]).filter(
        (button): button is UrlButton =>
          typeof button === "object" &&
          button !== null &&
          typeof (button as UrlButton).text === "string" &&
          typeof (button as UrlButton).url === "string",
      ),
    )
    .filter((row) => row.length > 0);
}

/** Parses "label | https://url" lines into one button per row. */
export function parseButtonLines(input: string): {
  buttons: UrlButton[][];
  error?: string;
} {
  const rows: UrlButton[][] = [];
  for (const rawLine of input.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.lastIndexOf("|");
    if (separator <= 0) {
      return { buttons: [], error: `قالب دکمه «${line}» درست نیست. مثال: خرید | https://example.com` };
    }
    const text = line.slice(0, separator).trim();
    const url = line.slice(separator + 1).trim();
    if (!text || text.length > 64) {
      return { buttons: [], error: "متن هر دکمه باید بین ۱ تا ۶۴ کاراکتر باشد." };
    }
    try {
      const parsed = new URL(url);
      if (!["https:", "http:", "tg:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return { buttons: [], error: `آدرس دکمه «${text}» معتبر نیست.` };
    }
    rows.push([{ text, url }]);
  }
  if (rows.length > MAX_BUTTON_ROWS) {
    return { buttons: [], error: `حداکثر ${MAX_BUTTON_ROWS.toLocaleString("fa-IR")} دکمه مجاز است.` };
  }
  return { buttons: rows };
}

export function buttonsToLines(value: Prisma.JsonValue | null) {
  return parseButtons(value)
    .flat()
    .map((button) => `${button.text} | ${button.url}`)
    .join("\n");
}

/** Extracts a storable post from a private message; null when unsupported. */
export function capturePostFromMessage(message: any): CapturedPost | null {
  const base = {
    sourceChatId: String(message.chat.id),
    sourceMessageId: Number(message.message_id),
  };
  const caption = message.caption ?? null;
  const captionEntities = message.caption_entities ?? [];

  if (typeof message.text === "string") {
    return {
      ...base,
      content: message.text,
      entities: message.entities ?? [],
      mediaType: "NONE",
      mediaFileId: null,
    };
  }

  const media: [MediaType, string | undefined][] = [
    ["IMAGE", message.photo?.at?.(-1)?.file_id],
    ["ANIMATION", message.animation?.file_id],
    ["VIDEO", message.video?.file_id],
    ["AUDIO", message.audio?.file_id],
    ["DOCUMENT", message.document?.file_id],
  ];
  const found = media.find(([, fileId]) => typeof fileId === "string");
  if (!found) return null;

  return {
    ...base,
    content: caption,
    entities: captionEntities,
    mediaType: found[0],
    mediaFileId: found[1]!,
  };
}

export function postPreviewText(post: {
  content: string | null;
  mediaType: MediaType;
}, length = 120) {
  const text = post.content?.trim();
  if (!text) {
    return post.mediaType === "NONE"
      ? "پست بدون متن"
      : `${MEDIA_TYPE_LABELS[post.mediaType]} بدون توضیح`;
  }
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

type SendCall = { method: string; payload: Record<string, unknown> };

function storedCall(
  platform: BotPlatform,
  post: SendablePost,
  chatId: string,
): SendCall | null {
  const withEntities = platform === "TELEGRAM";
  const rows = parseButtons(post.buttons);
  const replyMarkup = rows.length ? { reply_markup: { inline_keyboard: rows } } : {};
  const entities = Array.isArray(post.entities) && post.entities.length
    ? post.entities
    : undefined;

  if (post.mediaFileId && post.mediaType !== "NONE") {
    const [method, field] = MEDIA_METHODS[post.mediaType];
    return {
      method,
      payload: {
        chat_id: chatId,
        [field]: post.mediaFileId,
        ...(post.content ? { caption: post.content } : {}),
        ...(withEntities && entities && post.content ? { caption_entities: entities } : {}),
        ...replyMarkup,
      },
    };
  }

  if (post.content) {
    return {
      method: "sendMessage",
      payload: {
        chat_id: chatId,
        text: post.content,
        ...(withEntities && entities ? { entities } : {}),
        ...replyMarkup,
      },
    };
  }

  return null;
}

/**
 * Sends a post with the most robust available strategy. Stored data wins;
 * legacy posts fall back from copyMessage to their stored text.
 */
export async function sendPost(
  provider: BotPlatformProvider,
  token: string,
  chatId: string,
  post: SendablePost,
): Promise<SendResult> {
  const calls: SendCall[] = [];
  const hasStoredBody = Boolean(post.mediaFileId) || post.entities !== null;
  const stored = storedCall(provider.platform, post, chatId);

  if (hasStoredBody && stored) {
    calls.push(stored);
  } else {
    if (post.sourceChatId && post.sourceMessageId) {
      const rows = parseButtons(post.buttons);
      calls.push({
        method: "copyMessage",
        payload: {
          chat_id: chatId,
          from_chat_id: post.sourceChatId,
          message_id: post.sourceMessageId,
          ...(rows.length ? { reply_markup: { inline_keyboard: rows } } : {}),
        },
      });
    }
    if (stored) calls.push(stored);
  }

  if (!calls.length) {
    return {
      ok: false,
      error: classifyDeliveryError({ description: "message to copy not found" }),
    };
  }

  let lastError: ClassifiedDeliveryError | null = null;
  for (const call of calls) {
    const response = await provider.call<{ message_id?: number | string }>(
      token,
      call.method,
      call.payload,
    );
    if (response.ok) {
      const messageId = response.result?.message_id;
      return {
        ok: true,
        providerMessageId: messageId === undefined ? undefined : String(messageId),
      };
    }
    lastError = classifyDeliveryError(response);
    if (lastError.kind !== "CONTENT_MISSING") break;
  }

  return { ok: false, error: lastError! };
}
