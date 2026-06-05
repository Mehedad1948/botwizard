/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/bots/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addBotAction(formData: FormData) {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error("عدم دسترسی. لطفا وارد شوید.");
  }

  const token = formData.get("token") as string;
  if (!token) {
    throw new Error("توکن ربات الزامی است.");
  }

  try {
    // 1. Verify token with Telegram API
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error("توکن نامعتبر است. لطفا توکن صحیح را وارد کنید.");
    }

    const username = data.result.username;

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
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error("این ربات قبلا ثبت شده است.");
    }
    throw new Error("خطایی رخ داد. لطفا دوباره تلاش کنید.");
  }
}

// Notice the added formData parameter here to handle the .bind() correctly
export async function deleteBotAction(botId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.userId) throw new Error("Unauthorized");

  await prisma.bot.delete({
    where: { id: botId, userId: session.userId },
  });

  revalidatePath("/dashboard/bots");
  revalidatePath("/dashboard");
}
