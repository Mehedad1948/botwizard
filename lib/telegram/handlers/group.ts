/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleGroupAddition(my_chat_member: any, botToken: string) {
  const { chat, new_chat_member, from } = my_chat_member;
  
  if (new_chat_member.status === "administrator" || new_chat_member.status === "member") {
    
    // واکشی کاربر برای اتصال گروه به او
    const user = await prisma.user.findUnique({
      where: { telegramId: from.id.toString() },
      include: { bots: true }
    });

    if (user && user.bots.length > 0) {
      // await prisma.group.upsert({
      //   where: { chatId: chat.id.toString() },
      //   update: { title: chat.title, isActive: true },
      //   create: { chatId: chat.id.toString(), title: chat.title, botId: user.bots[0].id }
      // });
    }

    await callTelegramAPI("sendMessage", {
      chat_id: from.id,
      text: `✅ ربات به **${chat.title}** متصل شد.\nحالا می‌توانید پست‌ها را زمان‌بندی کنید.`,
      parse_mode: "Markdown"
    }, botToken);
  }
}
