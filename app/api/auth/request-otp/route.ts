import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// فرض می‌کنیم برای تلگرام از node-telegram-bot-api یا fetch مستقیم استفاده می‌کنید
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

export async function POST(req: Request) {
  try {
    const { phoneNumber, method } = await req.json();
    
    // استانداردسازی شماره
    const cleanPhone = phoneNumber.startsWith('0') 
      ? '+98' + phoneNumber.slice(1) 
      : phoneNumber;

    // تولید کد ۵ رقمی
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 دقیقه اعتبار

    // یافتن یا ساخت کاربر اولیه
    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!user) {
      user = await prisma.user.create({
        data: { phone: cleanPhone, otpCode: otp, otpExpires: expires }
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: otp, otpExpires: expires }
      });
    }

    if (method === 'telegram') {
      if (!user.telegramId) {
        return NextResponse.json({ 
          message: "شما هنوز ربات را استارت نکرده‌اید. لطفاً ابتدا ربات را استارت کنید و شماره خود را به اشتراک بگذارید." 
        }, { status: 404 });
      }
      
      // ارسال پیام به تلگرام کاربر
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: `کد تایید شما در بات‌ساز:\n\n${otp}`
        })
      });
    }

    // بخش پیامک (sms) را به سرویس پیامکی خود متصل کنید

    return NextResponse.json({ success: true, identifier: cleanPhone });
  } catch (error) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
