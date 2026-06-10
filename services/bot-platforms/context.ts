import { AsyncLocalStorage } from "node:async_hooks";

import type { BotPlatformValue } from "@/services/bot-platforms/config";

const botPlatformContext = new AsyncLocalStorage<BotPlatformValue>();

export function runWithBotPlatform<T>(
  platform: BotPlatformValue,
  callback: () => T,
): T {
  return botPlatformContext.run(platform, callback);
}

export function currentBotPlatform(): BotPlatformValue {
  return botPlatformContext.getStore() ?? "TELEGRAM";
}
