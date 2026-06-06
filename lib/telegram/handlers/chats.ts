// src/lib/telegram/handlers/chats.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleChatsCommand(message: any, bot: Bot, editMessageId?: number) {
  const chatId = message.chat?.id || message.message?.chat?.id;

  try {
    const connectedChats = await prisma.connectedChat.findMany({
      where: { botId: bot.id }
    });

    if (connectedChats.length === 0) {
      const text = "📭 این ربات در حال حاضر به هیچ گروهی متصل نیست.";
      if (editMessageId) {
        await callTelegramAPI("editMessageText", { chat_id: chatId, message_id: editMessageId, text }, bot.token);
      } else {
        await callTelegramAPI("sendMessage", { chat_id: chatId, text }, bot.token);
      }
      return;
    }

    let text = "👥 **لیست گروه‌های متصل به این ربات:**\n\n";
    const keyboard: any[] = [];

    connectedChats.forEach((chat, index) => {
      text += `${index + 1}. **${chat.chatTitle}**\n`;
      keyboard.push([
        { text: `🚪 خروج از: ${chat.chatTitle}`, callback_data: `leave_chat_${chat.chatId}` }
      ]);
    });

    keyboard.push([{ text: "❌ بستن لیست", callback_data: "close_menu" }]);

    if (editMessageId) {
      await callTelegramAPI("editMessageText", {
        chat_id: chatId, message_id: editMessageId,
        text, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      }, bot.token);
    } else {
      await callTelegramAPI("sendMessage", {
        chat_id: chatId, text, parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      }, bot.token);
    }
  } catch (error) {
    console.error("Error fetching chats:", error);
    await callTelegramAPI("sendMessage", { chat_id: chatId, text: "❌ خطا در دریافت لیست گروه‌ها." }, bot.token);
  }
}
