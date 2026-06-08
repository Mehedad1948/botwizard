import {
  generateLoginToken,
  generateOtp,
  hashLoginToken,
  hashOtp,
  maskPhone,
  normalizeIranianPhone,
} from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createOtpChallenge } from "@/lib/session";
import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_REQUEST_COOLDOWN_MS = 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizeIranianPhone(String(body.phoneNumber ?? ""));

    if (!phone) {
      return NextResponse.json(
        { error: "شماره موبایل واردشده معتبر نیست." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user?.telegramId) {
      return NextResponse.json(
        {
          message:
            "این شماره هنوز به ربات متصل نشده است. ابتدا ربات را باز کنید و شماره خودتان را با دکمه اشتراک‌گذاری ارسال کنید.",
        },
        { status: 404 }
      );
    }

    const now = new Date();

    if (
      user.otpRequestedAt &&
      now.getTime() - user.otpRequestedAt.getTime() < OTP_REQUEST_COOLDOWN_MS
    ) {
      return NextResponse.json(
        { error: "لطفاً یک دقیقه صبر کنید و سپس دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_LOGIN_BOT_TOKEN is not configured.");
    }

    const otp = generateOtp();
    const rawLoginToken = generateLoginToken();
    const expiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") ??
      new URL(req.url).origin;
    const loginUrl = `${baseUrl}/api/auth/telegram-link?token=${encodeURIComponent(rawLoginToken)}`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode: hashOtp(otp),
          otpExpires: expiresAt,
          otpAttempts: 0,
          otpRequestedAt: now,
        },
      }),
      prisma.loginToken.deleteMany({ where: { userId: user.id } }),
      prisma.loginToken.create({
        data: {
          userId: user.id,
          tokenHash: hashLoginToken(rawLoginToken),
          expiresAt,
        },
      }),
    ]);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: `🔐 <b>درخواست ورود به بات‌ویزارد</b>\n\nکد تأیید شما:\n<code>${otp}</code>\n\nاین کد و دکمه ورود فقط ۵ دقیقه اعتبار دارند. اگر شما این درخواست را انجام نداده‌اید، پیام را نادیده بگیرید.`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ورود امن به پنل", url: loginUrl }],
            ],
          },
        }),
      }
    );
    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            otpCode: null,
            otpExpires: null,
            otpAttempts: 0,
            otpRequestedAt: null,
          },
        }),
        prisma.loginToken.deleteMany({ where: { userId: user.id } }),
      ]);

      throw new Error("Telegram rejected the authentication message.");
    }

    await createOtpChallenge(user.id);

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(phone),
    });
  } catch (error) {
    console.error("OTP Error:", error);
    return NextResponse.json(
      { error: "ارسال پیام ورود انجام نشد. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}
