/* eslint-disable @typescript-eslint/no-explicit-any */

export async function callTelegramAPI(method: string, payload: any, token: string) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error) {
    console.error(`❌ [Telegram API Error - ${method}]:`, error);
    return null;
  }
}
