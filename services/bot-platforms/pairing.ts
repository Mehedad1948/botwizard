import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PAIRING_CODE_TTL_MS = 30 * 60 * 1000;

function pairingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET برای ساخت کد اتصال تنظیم نشده است.");
  }
  return secret;
}

export function generatePairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function hashPairingCode(code: string): string {
  return createHmac("sha256", pairingSecret())
    .update(code.trim().toUpperCase())
    .digest("hex");
}

export function pairingCodeExpiresAt(): Date {
  return new Date(Date.now() + PAIRING_CODE_TTL_MS);
}

export function verifyPairingCode(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPairingCode(code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
