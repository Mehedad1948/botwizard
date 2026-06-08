/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/session.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";
const OTP_CHALLENGE_COOKIE = "otp_challenge";

function getKey() {
  const secretKey = process.env.SESSION_SECRET;

  if (!secretKey || secretKey.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secretKey);
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, expires, purpose: "session" });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const payload = await decrypt(session);
    return payload.purpose === "session" || !payload.purpose ? payload : null;
  } catch {
    return null;
  }
}

export async function createOtpChallenge(userId: string) {
  const challenge = await new SignJWT({ userId, purpose: "otp" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getKey());
  const cookieStore = await cookies();

  cookieStore.set(OTP_CHALLENGE_COOKIE, challenge, {
    maxAge: 5 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function getOtpChallengeUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const challenge = cookieStore.get(OTP_CHALLENGE_COOKIE)?.value;

  if (!challenge) return null;

  try {
    const { payload } = await jwtVerify(challenge, getKey(), {
      algorithms: ["HS256"],
    });

    return payload.purpose === "otp" && typeof payload.userId === "string"
      ? payload.userId
      : null;
  } catch {
    return null;
  }
}

export async function clearOtpChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete(OTP_CHALLENGE_COOKIE);
}
