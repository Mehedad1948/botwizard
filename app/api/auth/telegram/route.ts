import { normalizeIranianPhone } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);
const NONCE_COOKIE = "telegram_login_nonce";

type TelegramClaims = {
  sub?: string;
  id?: number | string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
  nonce?: string;
};

export async function POST(req: Request) {
  try {
    const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;

    if (!clientId) {
      throw new Error("NEXT_PUBLIC_TELEGRAM_CLIENT_ID is not configured.");
    }

    const body = await req.json();
    const idToken = typeof body.id_token === "string" ? body.id_token : null;
    const cookieStore = await cookies();
    const expectedNonce = cookieStore.get(NONCE_COOKIE)?.value;

    if (!idToken || !expectedNonce) {
      return NextResponse.json(
        { error: "درخواست ورود تلگرام معتبر نیست." },
        { status: 400 }
      );
    }

    const { payload } = await jwtVerify<TelegramClaims>(
      idToken,
      TELEGRAM_JWKS,
      {
        issuer: TELEGRAM_ISSUER,
        audience: clientId,
      }
    );

    if (payload.nonce !== expectedNonce) {
      return NextResponse.json(
        { error: "اعتبار درخواست ورود تلگرام تأیید نشد." },
        { status: 401 }
      );
    }

    const telegramId = String(payload.id ?? payload.sub ?? "");
    const phone = payload.phone_number
      ? normalizeIranianPhone(payload.phone_number)
      : null;

    if (!telegramId) {
      return NextResponse.json(
        { error: "شناسه حساب تلگرام دریافت نشد." },
        { status: 400 }
      );
    }

    const [telegramUser, phoneUser] = await Promise.all([
      prisma.user.findUnique({ where: { telegramId } }),
      phone ? prisma.user.findUnique({ where: { phone } }) : null,
    ]);

    if (telegramUser && phoneUser && telegramUser.id !== phoneUser.id) {
      return NextResponse.json(
        {
          error:
            "شماره موبایل و حساب تلگرام به دو حساب متفاوت متصل هستند. برای بررسی حساب با پشتیبانی تماس بگیرید.",
        },
        { status: 409 }
      );
    }

    if (phoneUser?.telegramId && phoneUser.telegramId !== telegramId) {
      return NextResponse.json(
        {
          error:
            "این شماره موبایل قبلاً به حساب تلگرام دیگری متصل شده است. برای بررسی حساب با پشتیبانی تماس بگیرید.",
        },
        { status: 409 }
      );
    }

    if (telegramUser?.phone && phone && telegramUser.phone !== phone) {
      return NextResponse.json(
        {
          error:
            "این حساب تلگرام قبلاً با شماره دیگری ثبت شده است. برای تغییر شماره با پشتیبانی تماس بگیرید.",
        },
        { status: 409 }
      );
    }

    const existingUser = telegramUser ?? phoneUser;
    const nameParts = payload.name?.trim().split(/\s+/) ?? [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(" ") || null;

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            telegramId,
            phone: phone ?? existingUser.phone,
            firstName: firstName ?? existingUser.firstName,
            lastName: lastName ?? existingUser.lastName,
            username:
              payload.preferred_username ?? existingUser.username,
            photoUrl: payload.picture ?? existingUser.photoUrl,
          },
        })
      : await prisma.user.create({
          data: {
            telegramId,
            phone,
            firstName,
            lastName,
            username: payload.preferred_username ?? null,
            photoUrl: payload.picture ?? null,
          },
        });

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
      prisma.loginToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
    ]);

    cookieStore.delete(NONCE_COOKIE);
    await createSession(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram OIDC authentication failed:", error);
    return NextResponse.json(
      { error: "ورود با تلگرام انجام نشد. لطفاً دوباره تلاش کنید." },
      { status: 401 }
    );
  }
}
