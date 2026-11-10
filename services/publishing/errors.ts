import type { BotApiResponse } from "@/services/bot-platforms/provider";

export type DeliveryErrorKind =
  | "NO_PERMISSION"
  | "REMOVED"
  | "BLOCKED"
  | "RATE_LIMITED"
  | "TRANSIENT"
  | "CONTENT_MISSING"
  | "TERMINAL";

export type ClassifiedDeliveryError = {
  kind: DeliveryErrorKind;
  /** Persian, user-facing and actionable. */
  message: string;
  /** Raw provider description with secrets removed, for support. */
  detail: string;
  retryAfterSeconds?: number;
};

export const RETRYABLE_KINDS: ReadonlySet<DeliveryErrorKind> = new Set([
  "RATE_LIMITED",
  "TRANSIENT",
]);

const MESSAGES: Record<DeliveryErrorKind, string> = {
  NO_PERMISSION:
    "ربات اجازه ارسال پیام در این مقصد را ندارد. ربات را مدیر کنید و دسترسی «ارسال پیام» را به آن بدهید.",
  REMOVED:
    "ربات دیگر عضو این مقصد نیست. دوباره ربات را به گروه یا کانال اضافه کنید.",
  BLOCKED: "کاربر ربات را مسدود کرده یا گفت‌وگو در دسترس نیست.",
  RATE_LIMITED:
    "پیام‌رسان موقتاً سرعت ارسال را محدود کرده است؛ ارسال خودکار دوباره تلاش می‌شود.",
  TRANSIENT:
    "ارتباط با پیام‌رسان برقرار نشد؛ ارسال خودکار دوباره تلاش می‌شود.",
  CONTENT_MISSING:
    "محتوای این پست دیگر در دسترس نیست. پست را دوباره بسازید یا فایل را مجدداً بارگذاری کنید.",
  TERMINAL: "پیام‌رسان این ارسال را نپذیرفت.",
};

const SKIP_MESSAGES: Record<string, string> = {
  BOT_INACTIVE: "ربات در زمان ارسال غیرفعال بود.",
  DESTINATION_INACTIVE:
    "این مقصد در زمان ارسال در دسترس نبود (ربات حذف شده یا دسترسی ندارد).",
};

export function deliveryErrorMessage(kind: string | null | undefined) {
  if (kind && kind in SKIP_MESSAGES) return SKIP_MESSAGES[kind];
  return kind && kind in MESSAGES
    ? MESSAGES[kind as DeliveryErrorKind]
    : MESSAGES.TERMINAL;
}

export function sanitizeProviderDetail(value: unknown) {
  const text = value instanceof Error ? value.message : String(value ?? "");
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "[bot-token]")
    .replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "[bot-token]")
    .slice(0, 500);
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

export function classifyDeliveryError(
  response: Pick<BotApiResponse, "description" | "error_code" | "parameters">,
): ClassifiedDeliveryError {
  const detail = sanitizeProviderDetail(response.description);
  const text = detail.toLowerCase();
  const build = (
    kind: DeliveryErrorKind,
    retryAfterSeconds?: number,
  ): ClassifiedDeliveryError => ({
    kind,
    message: MESSAGES[kind],
    detail,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  });

  if (response.error_code === 429 || response.parameters?.retry_after) {
    return build("RATE_LIMITED", response.parameters?.retry_after);
  }

  if (
    includesAny(text, [
      "not enough rights",
      "need administrator rights",
      "chat_write_forbidden",
      "have no rights to send",
      "chat_admin_required",
      "topic_closed",
    ])
  ) {
    return build("NO_PERMISSION");
  }

  if (
    includesAny(text, [
      "bot was kicked",
      "bot is not a member",
      "chat not found",
      "group chat was upgraded",
      "chat was deleted",
      "the group chat was deleted",
    ])
  ) {
    return build("REMOVED");
  }

  if (
    includesAny(text, [
      "bot was blocked",
      "user is deactivated",
      "can't initiate conversation",
    ])
  ) {
    return build("BLOCKED");
  }

  if (
    includesAny(text, [
      "message to copy not found",
      "wrong file identifier",
      "wrong remote file",
      "file reference",
    ])
  ) {
    return build("CONTENT_MISSING");
  }

  if (
    response.error_code === undefined ||
    response.error_code >= 500 ||
    includesAny(text, ["timeout", "temporarily", "برقرار نشد"])
  ) {
    return build("TRANSIENT");
  }

  return build("TERMINAL");
}

/** Exponential backoff for retryable deliveries, in milliseconds. */
export function retryDelayMilliseconds(
  attempts: number,
  retryAfterSeconds?: number,
) {
  if (retryAfterSeconds) return (retryAfterSeconds + 1) * 1000;
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}
