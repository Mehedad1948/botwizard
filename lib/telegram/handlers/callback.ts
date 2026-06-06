// src/lib/telegram/handlers/callback.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";

export async function handleCallbackQuery(callback_query: any, bot: Bot) {
    const data = callback_query.data;
    const chatId = callback_query.message.chat.id;
    const messageId = callback_query.message.message_id;

    // 1. Cancel
    if (data === "cancel_draft") {
        await callTelegramAPI("editMessageText", {
            chat_id: chatId, message_id: messageId,
            text: "❌ عملیات لغو شد."
        }, bot.token);
        return;
    }

    // 2. Initial Group Selection (Send Now & Schedule)
    if (data.startsWith("send_now_") || data.startsWith("sch_")) {
        const action = data.startsWith("send_now_") ? "sn" : "sch";
        const draftId = data.split("_")[action === "sn" ? 2 : 1];

        // Fetch connected groups directly using bot.id
        const connectedGroups = await prisma.connectedChat.findMany({
            where: { botId: bot.id }
        });

        if (connectedGroups.length === 0) {
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: "❌ ربات در هیچ گروهی عضو نیست."
            }, bot.token);
            return;
        }

        // Generate checkboxes
        const keyboard = connectedGroups.map(group => (
            [{ text: `⬜️ ${group.chatTitle}`, callback_data: `tgl_${action}_${draftId}_${group.chatId}` }]
        ));

        keyboard.push([{ text: "✅ تایید و ادامه", callback_data: `confirm_${action}_${draftId}` }]);
        keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

        await callTelegramAPI("editMessageText", {
            chat_id: chatId, message_id: messageId,
            text: "لطفاً گروه‌های مقصد را انتخاب کنید:",
            reply_markup: { inline_keyboard: keyboard }
        }, bot.token);
        return;
    }

    // 3. Toggle Checkbox
    if (data.startsWith("tgl_")) {
        const currentKeyboard = callback_query.message.reply_markup.inline_keyboard;

        for (const row of currentKeyboard) {
            for (const btn of row) {
                if (btn.callback_data === data) {
                    if (btn.text.startsWith("⬜️")) {
                        btn.text = btn.text.replace("⬜️", "✅");
                    } else if (btn.text.startsWith("✅")) {
                        btn.text = btn.text.replace("✅", "⬜️");
                    }
                }
            }
        }

        await callTelegramAPI("editMessageReplyMarkup", {
            chat_id: chatId, message_id: messageId,
            reply_markup: { inline_keyboard: currentKeyboard }
        }, bot.token);
        return;
    }

    // 4. Confirm Selection
    if (data.startsWith("confirm_")) {
        const action = data.split("_")[1];
        const draftId = data.split("_")[2];
        const currentKeyboard = callback_query.message.reply_markup.inline_keyboard;

        const selectedChatIds: string[] = [];
        for (const row of currentKeyboard) {
            for (const btn of row) {
                if (btn.text.startsWith("✅") && btn.callback_data?.startsWith("tgl_")) {
                    const cId = btn.callback_data.split("_").slice(3).join("_");
                    selectedChatIds.push(cId);
                }
            }
        }

        if (selectedChatIds.length === 0) {
            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "⚠️ لطفاً حداقل یک گروه را انتخاب کنید!",
                show_alert: true
            }, bot.token);
            return;
        }

        if (action === "sn") {
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `🚀 در حال ارسال به ${selectedChatIds.length} گروه...\nلطفاً شکیبا باشید.`
            }, bot.token);

            let successCount = 0;
            let failCount = 0;

            try {
                for (const targetChatId of selectedChatIds) {
                    try {
                        const response = await callTelegramAPI("copyMessage", {
                            chat_id: targetChatId, 
                            from_chat_id: chatId,  
                            message_id: parseInt(draftId, 10),
                        }, bot.token);

                        if (response && response.ok) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (sendError) {
                        failCount++;
                    }
                }

                await callTelegramAPI("editMessageText", {
                    chat_id: chatId, message_id: messageId,
                    text: `✅ ارسال فوری پایان یافت!\n\n✔️ موفق: ${successCount} گروه\n❌ ناموفق: ${failCount} گروه`
                }, bot.token);

            } catch (error: any) {
                await callTelegramAPI("editMessageText", {
                    chat_id: chatId, message_id: messageId,
                    text: `❌ خطای سیستمی رخ داد:\n${error.message}`
                }, bot.token);
            }
            return;
        }

        else if (action === "sch") {
            const joinedChats = selectedChatIds.join(",");
            const intervals = [
                { label: "هر ۲ ساعت", hours: 2 },
                { label: "هر ۱۲ ساعت", hours: 12 },
                { label: "هر ۲۴ ساعت", hours: 24 },
            ];

            const keyboard = intervals.map(inv => (
                [{ text: `⏳ ${inv.label}`, callback_data: `si_${draftId}_${inv.hours}?c=${joinedChats}`.substring(0, 64) }]
            ));
            keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ ${selectedChatIds.length} گروه انتخاب شد.\nبازه زمانی تکرار را انتخاب کنید:`,
                reply_markup: { inline_keyboard: keyboard }
            }, bot.token);
            return;
        }
    }

    // 5. Interval Selected -> Save Campaigns
    if (data.startsWith("si_")) {
        const hoursPart = data.split("_")[2].split("?")[0];
        const intervalNum = parseInt(hoursPart);
        const chatIdsString = data.split("?c=")[1];
        const targetGroups = chatIdsString.split(",");

        try {
            // Fetch the latest post directly using bot.id
            const latestPost = await prisma.post.findFirst({
                where: { botId: bot.id },
                orderBy: { createdAt: 'desc' }
            });

            if (!latestPost) throw new Error("Post not found");

            for (const tId of targetGroups) {
                await prisma.campaign.create({
                    data: {
                        botId: bot.id,
                        postId: latestPost.id,
                        chatId: tId,
                        chatTitle: "گروه انتخاب شده",
                        intervalHours: intervalNum,
                        isActive: true,
                        nextRun: new Date(Date.now() + intervalNum * 60 * 60 * 1000),
                    }
                });
            }

            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ کمپین‌ها با موفقیت ثبت شدند.\nپست شما در ${targetGroups.length} گروه هر ${intervalNum} ساعت ارسال خواهد شد.`
            }, bot.token);

        } catch (error) {
            console.error("Error creating campaigns:", error);
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: "❌ خطایی در ذخیره کمپین رخ داد."
            }, bot.token);
        }
        return;
    }

    await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, bot.token);
}
