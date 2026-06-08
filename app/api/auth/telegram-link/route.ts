import { hashLoginToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const token = requestUrl.searchParams.get("token");
  const loginUrl = new URL("/login", requestUrl.origin);

  if (!token) {
    loginUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(loginUrl);
  }

  const tokenHash = hashLoginToken(token);
  const now = new Date();

  const userId = await prisma.$transaction(async (transaction) => {
    const loginToken = await transaction.loginToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (
      !loginToken ||
      loginToken.usedAt ||
      loginToken.expiresAt <= now
    ) {
      return null;
    }

    const consumed = await transaction.loginToken.updateMany({
      where: {
        id: loginToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      return null;
    }

    await transaction.user.update({
      where: { id: loginToken.userId },
      data: {
        otpCode: null,
        otpExpires: null,
        otpAttempts: 0,
        otpRequestedAt: null,
      },
    });

    return loginToken.userId;
  });

  if (!userId) {
    loginUrl.searchParams.set("error", "expired_link");
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  await createSession(userId);
  const response = NextResponse.redirect(
    new URL("/dashboard", requestUrl.origin)
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
