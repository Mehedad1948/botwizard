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
  [key: string]: unknown;
};

export type BotIdentity = {
  id: number | string;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
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
