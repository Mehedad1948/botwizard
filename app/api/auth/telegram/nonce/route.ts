import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const NONCE_COOKIE = "telegram_login_nonce";

export async function POST() {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(NONCE_COOKIE, nonce, {
    maxAge: 5 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  return NextResponse.json({ nonce });
}
