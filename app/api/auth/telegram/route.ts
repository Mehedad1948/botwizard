/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/telegram/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession } from "@/lib/session";
import crypto from "crypto";

// This verifies the standalone Telegram Login Widget
function verifyTelegramLogin(data: any, botToken: string) {
  const { hash, ...userData } = data;
  const dataCheckString = Object.keys(userData)
    .sort()
    .map((key) => `${key}=${userData[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return calculatedHash === hash;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN; // Bot token used for the login widget

    if (!botToken || !verifyTelegramLogin(data, botToken)) {
      return NextResponse.json({ error: "Invalid Telegram authentication" }, { status: 401 });
    }

    const telegramId = data.id.toString();

    // Upsert User
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: data.first_name,
        lastName: data.last_name,
        username: data.username,
        photoUrl: data.photo_url,
      },
      create: {
        telegramId,
        firstName: data.first_name,
        lastName: data.last_name,
        username: data.username,
        photoUrl: data.photo_url,
      },
    });

    await createSession(user.id);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Auth Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
