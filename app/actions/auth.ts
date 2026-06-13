"use server";

import { verifyOtpHash } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  clearSession,
  clearOtpChallenge,
  createSession,
  getOtpChallengeUserId,
} from "@/lib/session";
import { redirect } from "next/navigation";

const MAX_OTP_ATTEMPTS = 5;

export async function verifyOtpAction(code: string) {
  try {
    if (!/^\d{5}$/.test(code)) {
      return { error: "کد تأیید باید پنج رقم باشد." };
    }

    const userId = await getOtpChallengeUserId();

    if (!userId) {
      return { error: "درخواست ورود منقضی شده است. دوباره کد دریافت کنید." };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.otpCode || !user.otpExpires) {
      await clearOtpChallenge();
      return { error: "درخواست ورود معتبر نیست. دوباره کد دریافت کنید." };
    }

    if (user.otpExpires <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpires: null, otpAttempts: 0 },
      });
      await clearOtpChallenge();
      return { error: "کد تأیید منقضی شده است. دوباره کد دریافت کنید." };
    }

    if (!verifyOtpHash(code, user.otpCode)) {
      const attempts = user.otpAttempts + 1;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: attempts,
          ...(attempts >= MAX_OTP_ATTEMPTS
            ? { otpCode: null, otpExpires: null }
            : {}),
        },
      });

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await clearOtpChallenge();
        return {
          error: "تعداد تلاش‌های ناموفق بیش از حد مجاز بود. کد جدید دریافت کنید.",
        };
      }

      return { error: "کد واردشده صحیح نیست." };
    }

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

    await clearOtpChallenge();
    await createSession(user.id);

    return { success: true };
  } catch {
    return { error: "اعتبارسنجی انجام نشد. لطفاً دوباره تلاش کنید." };
  }
}

export async function logoutAction() {
  await clearOtpChallenge();
  await clearSession();
  redirect("/login");
}
