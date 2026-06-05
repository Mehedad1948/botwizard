/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleStartAndAuth(message: any, botToken: string) {
  const { text, from, chat, contact } = message;
  const telegramId = from.id.toString();
  const appUrl = "https://botwizard-oesj.vercel.app";

  const guideText = `
🤖 **راهنمای استفاده از دستیار هوشمند:**

1️⃣ **اتصال گروه/کانال:** مرا به عنوان مدیر (Admin) به گروه یا کانال خود اضافه کنید تا بتوانم آنجا پست بگذارم.
2️⃣ **ایجاد پست:** هر عکس، متن، ویدیو یا فایلی که دارید را به همین چت خصوصی بفرستید (یا فوروارد کنید).
3️⃣ **انتشار:** به محض دریافت، به شما دکمه‌هایی می‌دهم تا آن را فوراً منتشر کنید یا در سایت برای آینده زمان‌بندی کنید.
  `;

  if (contact && contact.phone_number) {
    let phone = contact.phone_number;
    if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
    if (phone.startsWith('98')) phone = '0' + phone.slice(2);

    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
      where: { telegramId },
      data: { phone, otpCode: otp, otpExpires: expires },
    });

    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "✅ شماره شما با موفقیت تایید شد.",
      reply_markup: { remove_keyboard: true }
    }, botToken);

    const loginUrl = `${appUrl}/login?step=verify&phone=${phone}`;
    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: `کد ورود شما: ${otp}\n\n${guideText}`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 ورود سریع به پنل کاربری", url: loginUrl }]]
      }
    }, botToken);
    return;
  }

  if (text && text.startsWith("/start")) {
    const existingUser = await prisma.user.findUnique({
      where: { telegramId },
      select: { phone: true }
    });

    if (existingUser && existingUser.phone) {
      await callTelegramAPI("sendMessage", {
        chat_id: chat.id,
        text: `سلام مجدد! 👋\nشما قبلاً ثبت نام کرده‌اید.\n\n${guideText}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 ورود به پنل کاربری", url: `${appUrl}/dashboard` }],
            [{ text: "➕ ایجاد ربات جدید", url: `${appUrl}/dashboard/bots` }]
          ]
        }
      }, botToken);
      return;
    }

    await prisma.user.upsert({
      where: { telegramId },
      update: { firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
      create: { telegramId, firstName: from.first_name || "", lastName: from.last_name || null, username: from.username || null },
    });

    await callTelegramAPI("sendMessage", {
      chat_id: chat.id,
      text: "سلام! 👋 به دستیار هوشمند مدیریت پست خوش آمدید.\n\nبرای استفاده از امکانات ربات و ورود به پنل، لطفاً شماره موبایل خود را از طریق دکمه زیر ارسال کنید 👇",
      reply_markup: {
        keyboard: [[{ text: "📱 ارسال شماره موبایل", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }, botToken);
  }
}
