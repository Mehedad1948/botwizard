/* eslint-disable @typescript-eslint/no-explicit-any */

import { currentBotPlatform } from "@/services/bot-platforms/context";
import { callBotPlatformApi } from "@/services/bot-platforms/provider";

export async function callTelegramAPI(
  method: string,
  payload: any,
  token: string,
): Promise<any> {
  return callBotPlatformApi(method, payload, token, currentBotPlatform());
}
