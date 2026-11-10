/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Bot, ChatType, DestinationStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import { classifyDeliveryError } from "./errors";

export const DESTINATION_STATUS_LABELS: Record<DestinationStatus, string> = {
  ACTIVE: "آماده ارسال",
  NO_PERMISSION: "بدون دسترسی ارسال",
  REMOVED: "ربات حذف شده",
};

export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  CHANNEL: "کانال",
  SUPERGROUP: "گروه",
  GROUP: "گروه",
  UNKNOWN: "مقصد",
};

const STATUS_HELP: Record<DestinationStatus, string> = {
  ACTIVE: "ربات می‌تواند در این مقصد پیام ارسال کند.",
  NO_PERMISSION:
    "ربات عضو است اما اجازه ارسال ندارد. در کانال، ربات را مدیر کنید و «ارسال پیام» را فعال کنید.",
  REMOVED: "ربات دیگر عضو این مقصد نیست. برای ادامه ارسال، دوباره آن را اضافه کنید.",
};

export function destinationStatusHelp(status: DestinationStatus) {
  return STATUS_HELP[status];
}

export function chatTypeFromPlatform(type: unknown): ChatType {
  if (type === "channel") return "CHANNEL";
  if (type === "supergroup") return "SUPERGROUP";
  if (type === "group") return "GROUP";
  return "UNKNOWN";
}

/** Derives posting ability from a Bot API ChatMember object. */
export function statusFromChatMember(
  member: any,
  chatType: ChatType,
): DestinationStatus {
  switch (member?.status) {
    case "creator":
      return "ACTIVE";
    case "administrator":
      if (chatType === "CHANNEL") {
        return member.can_post_messages === false ? "NO_PERMISSION" : "ACTIVE";
      }
      return "ACTIVE";
    case "member":
      return chatType === "CHANNEL" ? "NO_PERMISSION" : "ACTIVE";
    case "restricted":
      if (member.is_member === false) return "REMOVED";
      return member.can_send_messages === false ? "NO_PERMISSION" : "ACTIVE";
    case "left":
    case "kicked":
      return "REMOVED";
    default:
      return "NO_PERMISSION";
  }
}

export type MembershipChange = {
  chatId: string;
  chatTitle: string;
  status: DestinationStatus;
  created: boolean;
};

/**
 * Applies a `my_chat_member` update. Only the owner can add a destination;
 * removals and permission changes apply to known destinations from anyone.
 */
export async function applyMembershipUpdate(
  bot: Pick<Bot, "id" | "ownerPlatformUserId">,
  update: any,
): Promise<MembershipChange | null> {
  const chat = update?.chat;
  if (!chat || chat.type === "private") return null;

  const chatId = String(chat.id);
  const chatType = chatTypeFromPlatform(chat.type);
  const status = statusFromChatMember(update.new_chat_member, chatType);
  const chatTitle = chat.title || "بدون نام";
  const fromOwner =
    update.from?.id !== undefined &&
    String(update.from.id) === bot.ownerPlatformUserId;

  const existing = await prisma.connectedChat.findUnique({
    where: { botId_chatId: { botId: bot.id, chatId } },
    select: { id: true },
  });

  if (!existing) {
    if (!fromOwner || status === "REMOVED") return null;
    await prisma.connectedChat.create({
      data: {
        botId: bot.id,
        chatId,
        chatTitle,
        chatType,
        status,
        lastCheckedAt: new Date(),
      },
    });
    return { chatId, chatTitle, status, created: true };
  }

  await prisma.connectedChat.update({
    where: { id: existing.id },
    data: {
      chatTitle,
      chatType,
      status,
      statusReason: null,
      lastCheckedAt: new Date(),
    },
  });
  return { chatId, chatTitle, status, created: false };
}

/** Bale reports joins as service messages instead of `my_chat_member`. */
export async function applyServiceMessage(
  bot: Pick<Bot, "id" | "username" | "ownerPlatformUserId">,
  message: any,
): Promise<MembershipChange | null> {
  const isSelf = (member: any) =>
    member?.username?.toLowerCase() === bot.username.toLowerCase();

  if (message?.migrate_to_chat_id) {
    await prisma.connectedChat.updateMany({
      where: { botId: bot.id, chatId: String(message.chat.id) },
      data: { chatId: String(message.migrate_to_chat_id), chatType: "SUPERGROUP" },
    });
    return null;
  }

  if (isSelf(message?.left_chat_member)) {
    return applyMembershipUpdate(bot, {
      chat: message.chat,
      from: message.from,
      new_chat_member: { status: "left" },
    });
  }

  if ((message?.new_chat_members ?? []).some(isSelf)) {
    return applyMembershipUpdate(bot, {
      chat: message.chat,
      from: message.from,
      new_chat_member: {
        status: message.chat?.type === "channel" ? "administrator" : "member",
      },
    });
  }

  return null;
}

export function membershipNotice(change: MembershipChange) {
  const title = change.chatTitle;
  if (change.status === "ACTIVE") {
    return change.created
      ? `✅ «${title}» به مقصدهای ربات اضافه شد و آماده ارسال است.`
      : `✅ ربات دوباره می‌تواند در «${title}» ارسال کند.`;
  }
  if (change.status === "NO_PERMISSION") {
    return `⚠️ ربات به «${title}» اضافه شد اما اجازه ارسال ندارد.\n${STATUS_HELP.NO_PERMISSION}`;
  }
  return `🚫 ربات از «${title}» خارج شد. ارسال‌های این مقصد متوقف می‌شوند.`;
}

/** Asks the platform whether the bot can still post in a destination. */
export async function checkDestination(
  bot: Pick<Bot, "id" | "token" | "platform">,
  destinationId: string,
) {
  const destination = await prisma.connectedChat.findFirst({
    where: { id: destinationId, botId: bot.id },
  });
  if (!destination) return null;

  const provider = getBotPlatformProvider(bot.platform);
  const botUserId = bot.token.split(":", 1)[0];
  const response = await provider.call<any>(bot.token, "getChatMember", {
    chat_id: destination.chatId,
    user_id: Number(botUserId) || botUserId,
  });

  let status: DestinationStatus;
  let statusReason: string | null = null;
  if (response.ok) {
    status = statusFromChatMember(response.result, destination.chatType);
  } else {
    const error = classifyDeliveryError(response);
    if (error.kind === "TRANSIENT" || error.kind === "RATE_LIMITED") {
      return { ...destination, checkFailed: true as const };
    }
    status = error.kind === "NO_PERMISSION" ? "NO_PERMISSION" : "REMOVED";
    statusReason = error.detail;
  }

  const updated = await prisma.connectedChat.update({
    where: { id: destination.id },
    data: { status, statusReason, lastCheckedAt: new Date() },
  });
  return { ...updated, checkFailed: false as const };
}
