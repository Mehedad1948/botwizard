import type {
  BotPlatformValue,
  PlatformSlug,
} from "@/services/bot-platforms/config";
import {
  platformConfigs,
  slugFromPlatform,
} from "@/services/bot-platforms/config";

export type BotApiResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
  [key: string]: unknown;
};

export type BotIdentity = {
  id: number | string;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type PrivatePostContent = {
  content: string | null;
  sourceChatId: string | null;
  sourceMessageId: number | null;
};

export type ProviderErrorKind =
  | "BLOCKED"
  | "RATE_LIMITED"
  | "TRANSIENT"
  | "TERMINAL";

export type ProviderSendResult =
  | { ok: true; providerMessageId?: string }
  | {
      ok: false;
      kind: ProviderErrorKind;
      description: string;
      retryAfterSeconds?: number;
    };

export interface BotPlatformProvider {
  readonly platform: BotPlatformValue;
  readonly slug: PlatformSlug;
  call<T = unknown>(
    token: string,
    method: string,
    payload?: Record<string, unknown>,
  ): Promise<BotApiResponse<T>>;
  getMe(token: string): Promise<BotIdentity>;
  setWebhook(token: string, url: string): Promise<void>;
  deleteWebhook(token: string): Promise<void>;
  sendPrivatePost(
    token: string,
    privateChatId: string,
    post: PrivatePostContent,
  ): Promise<ProviderSendResult>;
}

class HttpBotPlatformProvider implements BotPlatformProvider {
  constructor(
    readonly platform: BotPlatformValue,
    readonly slug: PlatformSlug,
    private readonly apiBaseUrl: string,
  ) {}

  async call<T = unknown>(
    token: string,
    method: string,
    payload: Record<string, unknown> = {},
  ): Promise<BotApiResponse<T>> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        },
      );
      const data = (await response.json()) as BotApiResponse<T>;

      if (!response.ok || data.ok === false || data.error_code) {
        return {
          ...data,
          ok: false,
          description:
            data.description ||
            `درخواست ${method} در ${platformConfigs[this.slug].labelFa} ناموفق بود.`,
        };
      }

      return { ...data, ok: true };
    } catch (error) {
      console.error(
        `[${platformConfigs[this.slug].label} API Error - ${method}]`,
        error,
      );
      return {
        ok: false,
        description: `ارتباط با ${platformConfigs[this.slug].labelFa} برقرار نشد.`,
      };
    }
  }

  async getMe(token: string): Promise<BotIdentity> {
    const response = await this.call<BotIdentity>(token, "getMe");
    if (!response.ok || !response.result?.username) {
      throw new Error(response.description || "توکن ربات معتبر نیست.");
    }
    return response.result;
  }

  async setWebhook(token: string, url: string): Promise<void> {
    const response = await this.call(token, "setWebhook", { url });
    if (!response.ok) {
      throw new Error(response.description || "ثبت وب‌هوک ربات انجام نشد.");
    }
  }

  async deleteWebhook(token: string): Promise<void> {
    const response = await this.call(token, "deleteWebhook");
    if (!response.ok) {
      throw new Error(response.description || "حذف وب‌هوک ربات انجام نشد.");
    }
  }

  async sendPrivatePost(
    token: string,
    privateChatId: string,
    post: PrivatePostContent,
  ): Promise<ProviderSendResult> {
    const method =
      post.sourceChatId && post.sourceMessageId ? "copyMessage" : "sendMessage";
    const response = await this.call<{ message_id?: number | string }>(
      token,
      method,
      method === "copyMessage"
        ? {
            chat_id: privateChatId,
            from_chat_id: post.sourceChatId,
            message_id: post.sourceMessageId,
          }
        : {
            chat_id: privateChatId,
            text: post.content || "محتوای بدون متن",
          },
    );

    if (response.ok) {
      const messageId = response.result?.message_id;
      return {
        ok: true,
        providerMessageId:
          messageId === undefined ? undefined : String(messageId),
      };
    }

    return classifyProviderError(response);
  }
}

export function classifyProviderError(
  response: BotApiResponse,
): ProviderSendResult {
  const description = response.description || "ارسال پیام ناموفق بود.";
  const normalized = description.toLowerCase();

  if (
    normalized.includes("bot was blocked") ||
    normalized.includes("user is deactivated") ||
    normalized.includes("chat not found") ||
    normalized.includes("forbidden")
  ) {
    return { ok: false, kind: "BLOCKED", description };
  }

  if (response.error_code === 429 || response.parameters?.retry_after) {
    return {
      ok: false,
      kind: "RATE_LIMITED",
      description,
      retryAfterSeconds: response.parameters?.retry_after,
    };
  }

  if (
    response.error_code === undefined ||
    response.error_code >= 500 ||
    normalized.includes("timeout") ||
    normalized.includes("temporarily")
  ) {
    return { ok: false, kind: "TRANSIENT", description };
  }

  return { ok: false, kind: "TERMINAL", description };
}

const providers: Record<BotPlatformValue, BotPlatformProvider> = {
  TELEGRAM: new HttpBotPlatformProvider(
    "TELEGRAM",
    "telegram",
    "https://api.telegram.org",
  ),
  BALE: new HttpBotPlatformProvider(
    "BALE",
    "bale",
    "https://tapi.bale.ai",
  ),
};

export function getBotPlatformProvider(
  platform: BotPlatformValue,
): BotPlatformProvider {
  return providers[platform];
}

export function getBotPlatformProviderBySlug(
  slug: PlatformSlug,
): BotPlatformProvider {
  return providers[platformConfigs[slug].value];
}

export async function callBotPlatformApi<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
  token: string,
  platform: BotPlatformValue,
): Promise<BotApiResponse<T>> {
  return providers[platform].call<T>(token, method, payload);
}

export function getPlatformSlug(
  platform: BotPlatformValue,
): PlatformSlug {
  return slugFromPlatform(platform);
}
