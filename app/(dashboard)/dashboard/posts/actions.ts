/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function createPostAction(formData: FormData) {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error("عدم دسترسی. لطفا وارد شوید.");
  }

  const botId = formData.get("botId") as string;
  const content = formData.get("content") as string;
  const mediaType = formData.get("mediaType") as any; 
  const mediaUrl = formData.get("mediaUrl") as string | null;

  if (!botId) {
    throw new Error("انتخاب ربات الزامی است.");
  }

  try {
    // تایید اینکه این ربات متعلق به همین کاربر است (جلوگیری از دسترسی غیرمجاز)
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.userId },
    });

    if (!bot) {
      throw new Error("ربات یافت نشد یا دسترسی ندارید.");
    }

    await prisma.post.create({
      data: {
        botId,
        content: content || null,
        mediaType: mediaType || "NONE",
        mediaUrl: mediaUrl || null,
      },
    });

    revalidatePath("/dashboard/posts");
  } catch (error) {
    throw new Error("خطایی در ایجاد پست رخ داد.");
  }
}

export async function deletePostAction(postId: string) {
  const session = await getSession();
  if (!session?.userId) throw new Error("Unauthorized");

  try {
    // بررسی دسترسی: آیا این پست متعلق به رباتی است که برای این کاربر است؟
    const post = await prisma.post.findFirst({
      where: { 
        id: postId, 
        bot: { userId: session.userId } 
      },
    });

    if (!post) throw new Error("Post not found");

    await prisma.post.delete({
      where: { id: postId },
    });
    
    revalidatePath("/dashboard/posts");
  } catch (error) {
    throw new Error("خطایی در حذف پست رخ داد.");
  }
}

export async function createCampaignFromDashboardAction(formData: FormData) {
  const session = await getSession();
  if (!session?.userId) throw new Error("Unauthorized");

  const postId = formData.get("postId") as string;
  const chatId = formData.get("chatId") as string;
  const intervalHours = parseInt(formData.get("intervalHours") as string);

  if (!postId || !chatId || !intervalHours) throw new Error("اطلاعات ناقص است");

  // چک کردن دسترسی
  const post = await prisma.post.findFirst({
    where: { id: postId, bot: { userId: session.userId } },
  });
  if (!post) throw new Error("پست یافت نشد");

  await prisma.campaign.create({
    data: {
      botId: post.botId,
      postId: post.id,
      chatId: chatId,
      chatTitle: "گروه ثبت شده از داشبورد", // یا آیدی
      intervalHours: intervalHours,
      isActive: true,
      nextRun: new Date(Date.now() + intervalHours * 60 * 60 * 1000),
    }
  });

  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/posts");
}
