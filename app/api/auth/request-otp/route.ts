import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_LOGIN_BOT_TOKEN;

export async function POST(req: Request) {
  try {
    const { phoneNumber, method } = await req.json();
    
    // Normalize phone to start with 0 (e.g., 0912...) to match webhook
    let cleanPhone = phoneNumber;
    if (cleanPhone.startsWith('+98')) cleanPhone = '0' + cleanPhone.slice(3);
    if (cleanPhone.startsWith('98')) cleanPhone = '0' + cleanPhone.slice(2);

    // Generate 5-digit code
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Find user by normalized phone
    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    
    if (!user) {
      // If user isn't found, it means they never shared contact via Telegram
      return NextResponse.json({ 
        message: "شما هنوز ربات را استارت نکرده‌اید. لطفاً ابتدا ربات را استارت کنید و شماره خود را به اشتراک بگذارید." 
      }, { status: 404 });
    } else {
      // Update existing user with new OTP
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: otp, otpExpires: expires }
      });
    }

    if (method === 'telegram') {
      if (!user.telegramId) {
        return NextResponse.json({ 
          message: "اکانت تلگرام شما متصل نیست. لطفاً مجددا ربات را استارت کنید." 
        }, { status: 404 });
      }
      
      // Send OTP via Telegram
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: `کد تایید شما در بات‌ساز:\n\n${otp}`
        })
      });
    }

    // SMS logic goes here later...

    return NextResponse.json({ success: true, identifier: cleanPhone });
  } catch (error) {
    console.error("OTP Error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
