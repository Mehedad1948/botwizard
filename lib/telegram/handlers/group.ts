// src/lib/telegram/handlers/group.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleGroupAddition(my_chat_member: any, bot: Bot) {
  const { chat, new_chat_member, from } = my_chat_member;
  
  if (new_chat_member.status === "administrator" || new_chat_member.status === "member") {
    
    const chatId = chat.id.toString();
    const chatTitle = chat.title || "بدون نام";

    // ذخیره گروه متصل شده مستقیم با bot.id
    await prisma.connectedChat.upsert({
      where: { 
        botId_chatId: {
          botId: bot.id,
          chatId: chatId
        }
      },
      update: { 
        chatTitle: chatTitle 
      },
      create: { 
        botId: bot.id,
        chatId: chatId, 
        chatTitle: chatTitle 
      }
    });

    await callTelegramAPI("sendMessage", {
      chat_id: from.id,
      text: `✅ ربات به **${chatTitle}** متصل شد.\nحالا می‌توانید پست‌ها را زمان‌بندی کنید.`,
      parse_mode: "Markdown"
    }, bot.token);
  }
}

export async function handleNewChatMembers(message: any, bot: Bot) {
  const members = message.new_chat_members ?? [];
  const addedCurrentBot = members.some(
    (member: any) =>
      member.username?.toLowerCase() === bot.username.toLowerCase(),
  );

  if (!addedCurrentBot) return;

  const chatId = message.chat.id.toString();
  const chatTitle = message.chat.title || "بدون نام";

  await prisma.connectedChat.upsert({
    where: {
      botId_chatId: {
        botId: bot.id,
        chatId,
      },
    },
    update: { chatTitle },
    create: {
      botId: bot.id,
      chatId,
      chatTitle,
    },
  });

  if (message.from?.id) {
    await callTelegramAPI(
      "sendMessage",
      {
        chat_id: message.from.id,
        text: `✅ ربات به **${chatTitle}** متصل شد.\nحالا می‌توانید پست‌ها را زمان‌بندی کنید.`,
        parse_mode: "Markdown",
      },
      bot.token,
    );
  }
}
