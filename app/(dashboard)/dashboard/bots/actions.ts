/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/bots/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addBotAction(formData: FormData) {
  const session = await getSession();
  if (!session?.userId) {
    return { error: "ابتدا وارد حساب خود شوید." };
  }

  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { error: "توکن ربات الزامی است." };
  }

  try {
    // 1. Verify token with Telegram API
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error("توکن نامعتبر است. لطفا توکن صحیح را وارد کنید.");
    }

    const username = data.result.username;
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "");

    if (!baseUrl) {
      throw new Error("آدرس عمومی سامانه برای ثبت وب‌هوک تنظیم نشده است.");
    }

    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${baseUrl}/api/telegram/webhook/${token}`,
        }),
      }
    );
    const webhookResult = await webhookResponse.json();

    if (!webhookResponse.ok || !webhookResult.ok) {
      throw new Error(
        webhookResult.description || "ثبت وب‌هوک ربات انجام نشد."
      );
    }

    // 2. Save to database
    await prisma.bot.create({
      data: {
        userId: session.userId,
        token: token,
        username: username,
      },
    });

    revalidatePath("/dashboard/bots");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "این ربات قبلاً در سامانه ثبت شده است." };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    };
  }
}

// Notice the added formData parameter here to handle the .bind() correctly
export async function deleteBotAction(botId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: "ابتدا وارد حساب خود شوید." };

  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId: session.userId },
    select: { id: true, token: true },
  });

  if (!bot) return { error: "ربات یافت نشد یا به آن دسترسی ندارید." };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${bot.token}/deleteWebhook`,
      { method: "POST" }
    );
    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.warn("Telegram webhook cleanup failed:", result.description);
    }
  } catch {
    console.warn("Telegram webhook cleanup request failed.");
  }

  await prisma.bot.delete({ where: { id: bot.id } });

  revalidatePath("/dashboard/bots");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/posts");
  return { success: true };
}
