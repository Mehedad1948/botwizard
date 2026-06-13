import type { BotPlatformValue } from "@/services/bot-platforms/config";

export type PrivateSubscriberIdentity = {
  platform: BotPlatformValue;
  platformUserId: string;
  privateChatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

export type SubscriberCallbackAction =
  | { type: "LIST" }
  | { type: "STOP" }
  | { type: "TOGGLE"; callbackKey: string };

const CALLBACK_KEY_PATTERN = /^[A-Za-z0-9_-]{6,16}$/;

export function parseSubscriberCallback(
  value: unknown,
): SubscriberCallbackAction | null {
  if (value === "topic:list") return { type: "LIST" };
  if (value === "topic:stop") return { type: "STOP" };
  if (typeof value !== "string") return null;

  const match = value.match(/^topic:toggle:([A-Za-z0-9_-]{6,16})$/);
  if (!match || !CALLBACK_KEY_PATTERN.test(match[1])) return null;
  return { type: "TOGGLE", callbackKey: match[1] };
}

export function parseStartParameter(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/);
  return match?.[1] ?? null;
}
