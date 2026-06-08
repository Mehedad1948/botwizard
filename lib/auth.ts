import crypto from "crypto";

const OTP_LENGTH = 5;

function getAuthSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return secret;
}

export function normalizeIranianPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let normalized = digits;

  if (normalized.startsWith("+98")) {
    normalized = `0${normalized.slice(3)}`;
  } else if (normalized.startsWith("98")) {
    normalized = `0${normalized.slice(2)}`;
  }

  return /^09\d{9}$/.test(normalized) ? normalized : null;
}

export function generateOtp(): string {
  const minimum = 10 ** (OTP_LENGTH - 1);
  const maximum = 10 ** OTP_LENGTH;

  return crypto.randomInt(minimum, maximum).toString();
}

export function hashOtp(code: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`otp:${code}`)
    .digest("hex");
}

export function verifyOtpHash(code: string, expectedHash: string): boolean {
  const actualHash = Buffer.from(hashOtp(code), "hex");
  const storedHash = Buffer.from(expectedHash, "hex");

  return (
    actualHash.length === storedHash.length &&
    crypto.timingSafeEqual(actualHash, storedHash)
  );
}

export function generateLoginToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashLoginToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
