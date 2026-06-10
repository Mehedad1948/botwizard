export const platformSlugs = ["telegram", "bale"] as const;

export type PlatformSlug = (typeof platformSlugs)[number];
export type BotPlatformValue = "TELEGRAM" | "BALE";

type PlatformConfig = {
  slug: PlatformSlug;
  value: BotPlatformValue;
  label: string;
  labelFa: string;
  logo: string;
  botUrl: (username: string) => string;
  tokenGuideUrl: string;
  tokenIssuer: string;
};

export const platformConfigs: Record<PlatformSlug, PlatformConfig> = {
  telegram: {
    slug: "telegram",
    value: "TELEGRAM",
    label: "Telegram",
    labelFa: "تلگرام",
    logo: "/Telegram_blue_icon.png",
    botUrl: (username) => `https://t.me/${username}`,
    tokenGuideUrl: "https://t.me/BotFather",
    tokenIssuer: "@BotFather",
  },
  bale: {
    slug: "bale",
    value: "BALE",
    label: "Bale",
    labelFa: "بله",
    logo: "/Bale_logo.png",
    botUrl: (username) => `https://ble.ir/${username}`,
    tokenGuideUrl: "https://ble.ir/botfather",
    tokenIssuer: "@botfather",
  },
};

export function isPlatformSlug(value: string): value is PlatformSlug {
  return platformSlugs.includes(value as PlatformSlug);
}

export function platformFromSlug(slug: PlatformSlug): BotPlatformValue {
  return platformConfigs[slug].value;
}

export function slugFromPlatform(platform: BotPlatformValue): PlatformSlug {
  return platform === "BALE" ? "bale" : "telegram";
}

export function dashboardPath(
  platform: PlatformSlug,
  suffix = "",
): string {
  return `/dashboard/${platform}${suffix ? `/${suffix.replace(/^\/+/, "")}` : ""}`;
}
