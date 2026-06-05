"use server";

import  prisma  from "@/lib/prisma";
import { createSession } from "@/lib/session"; // تابعی که قبلا با jose ساختید

export async function verifyOtpAction(phone: string, code: string) {
  try {
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || user.otpCode !== code) {
      return { error: "کد وارد شده نامعتبر است" };
    }

    if (user.otpExpires && user.otpExpires < new Date()) {
      return { error: "کد تایید منقضی شده است" };
    }

    // پاک کردن کد بعد از استفاده
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpires: null }
    });

    // ایجاد سشن (کوکی ورود)
    await createSession(user.id);

    return { success: true };
  } catch  {
    return { error: "خطا در اعتبارسنجی" };
  }
}
