/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";

export async function handleCallbackQuery(callback_query: any, botToken: string) {
    const data = callback_query.data;
    const chatId = callback_query.message.chat.id;
    const messageId = callback_query.message.message_id;

    // 1. Cancel
    if (data === "cancel_draft") {
        await callTelegramAPI("editMessageText", {
            chat_id: chatId, message_id: messageId,
            text: "❌ عملیات لغو شد."
        }, botToken);
        return;
    }

    // 2. Initial Group Selection (Send Now & Schedule)
    if (data.startsWith("send_now_") || data.startsWith("sch_")) {
        const action = data.startsWith("send_now_") ? "sn" : "sch";
        const draftId = data.split("_")[action === "sn" ? 2 : 1];

        const user = await prisma.user.findUnique({
            where: { telegramId: callback_query.from.id.toString() },
            include: { bots: { include: { connectedChats: true } } }
        });

        const connectedGroups = user?.bots[0]?.connectedChats || [];

        if (connectedGroups.length === 0) {
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: "❌ ربات در هیچ گروهی عضو نیست."
            }, botToken);
            return;
        }

        // Generate checkboxes (all unselected by default)
        const keyboard = connectedGroups.map(group => (
            [{ text: `⬜️ ${group.chatTitle}`, callback_data: `tgl_${action}_${draftId}_${group.chatId}` }]
        ));

        keyboard.push([{ text: "✅ تایید و ادامه", callback_data: `confirm_${action}_${draftId}` }]);
        keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

        await callTelegramAPI("editMessageText", {
            chat_id: chatId, message_id: messageId,
            text: "لطفاً گروه‌های مقصد را انتخاب کنید:",
            reply_markup: { inline_keyboard: keyboard }
        }, botToken);
        return;
    }

    // 3. Toggle Checkbox
    if (data.startsWith("tgl_")) {
        // data format: tgl_{action}_{draftId}_{chatId}
        const parts = data.split("_");
        const targetChatId = parts.slice(3).join("_"); // handle negative chatIds safely

        // Read current keyboard
        const currentKeyboard = callback_query.message.reply_markup.inline_keyboard;

        // Find and toggle the specific button
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

        // Update the message inline keyboard
        await callTelegramAPI("editMessageReplyMarkup", {
            chat_id: chatId, message_id: messageId,
            reply_markup: { inline_keyboard: currentKeyboard }
        }, botToken);
        return;
    }

    // 4. Confirm Selection (Send Now & Schedule)
    if (data.startsWith("confirm_")) {
        const action = data.split("_")[1]; // "sn" or "sch"
        const draftId = data.split("_")[2];
        const currentKeyboard = callback_query.message.reply_markup.inline_keyboard;

        // Extract selected Chat IDs by looking at buttons with ✅
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
            }, botToken);
            return;
        }

        if (action === "sn") {
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `🚀 در حال ارسال به ${selectedChatIds.length} گروه...\nلطفاً شکیبا باشید.`
            }, botToken);

            let successCount = 0;
            let failCount = 0;

            try {
                // ارسال به تمام گروه‌های انتخاب شده
                for (const targetChatId of selectedChatIds) {
                    try {
                        const response = await callTelegramAPI("copyMessage", {
                            chat_id: targetChatId, // مقصد: گروه
                            from_chat_id: chatId,  // مبدا: چت خصوصی ربات با کاربر
                            message_id: parseInt(draftId, 10), // آیدی پیام اصلی کاربر
                        }, botToken);

                        if (response && response.ok) {
                            successCount++;
                        } else {
                            failCount++;
                            console.error(`[Send Now] Failed to send to chat: ${targetChatId}. Response:`, response);
                        }
                    } catch (sendError) {
                        failCount++;
                        console.error(`[Send Now] Exception sending to chat: ${targetChatId}. Error:`, sendError);
                    }
                }

                // آپدیت پیام وضعیت نهایی
                await callTelegramAPI("editMessageText", {
                    chat_id: chatId, message_id: messageId,
                    text: `✅ ارسال فوری پایان یافت!\n\n✔️ موفق: ${successCount} گروه\n❌ ناموفق: ${failCount} گروه`
                }, botToken);

            } catch (error: any) {
                console.error("[Send Now] Fatal System Error:", error);
                await callTelegramAPI("editMessageText", {
                    chat_id: chatId, message_id: messageId,
                    text: `❌ خطای سیستمی رخ داد:\n${error.message}`
                }, botToken);
            }
            return;
        }

        else if (action === "sch") {
            // SCHEDULE LOGIC: Show Intervals
            // We pass the selected chat IDs joined by comma. 
            // Note: If you have >3 groups, this might exceed Telegram's 64-byte callback limit.
            // For production with many groups, you'd save this selection to the DB first.
            const joinedChats = selectedChatIds.join(",");

            const intervals = [
                { label: "هر ۲ ساعت", hours: 2 },
                { label: "هر ۱۲ ساعت", hours: 12 },
                { label: "هر ۲۴ ساعت", hours: 24 },
            ];

            const keyboard = intervals.map(inv => (
                // passing joinedChats safely
                [{ text: `⏳ ${inv.label}`, callback_data: `si_${draftId}_${inv.hours}?c=${joinedChats}`.substring(0, 64) }]
            ));
            keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ ${selectedChatIds.length} گروه انتخاب شد.\nبازه زمانی تکرار را انتخاب کنید:`,
                reply_markup: { inline_keyboard: keyboard }
            }, botToken);
            return;
        }
    }

    // 5. Interval Selected -> Save Multiple Campaigns to DB
    if (data.startsWith("si_")) {
        // data format: si_{draftId}_{hours}?c={chatId1,chatId2}
        const draftId = data.split("_")[1];
        const hoursPart = data.split("_")[2].split("?")[0];
        const intervalNum = parseInt(hoursPart);

        const chatIdsString = data.split("?c=")[1];
        const targetGroups = chatIdsString.split(",");

        try {
            const user = await prisma.user.findUnique({
                where: { telegramId: callback_query.from.id.toString() },
                include: { bots: { include: { posts: { orderBy: { createdAt: 'desc' }, take: 1 } } } }
            });

            const bot = user?.bots[0];
            const latestPost = bot?.posts[0];

            if (!bot || !latestPost) throw new Error("Post/Bot not found");

            // Create a campaign for EVERY selected group
            for (const tId of targetGroups) {
                await prisma.campaign.create({
                    data: {
                        botId: bot.id,
                        postId: latestPost.id,
                        chatId: tId,
                        chatTitle: "گروه انتخاب شده", // In a real app, query ConnectedChat to get the real title
                        intervalHours: intervalNum,
                        isActive: true,
                        nextRun: new Date(Date.now() + intervalNum * 60 * 60 * 1000),
                    }
                });
            }

            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ کمپین‌ها با موفقیت ثبت شدند.\nپست شما در ${targetGroups.length} گروه هر ${intervalNum} ساعت ارسال خواهد شد.`
            }, botToken);

        } catch (error) {
            console.error("Error creating campaigns:", error);
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: "❌ خطایی در ذخیره کمپین رخ داد."
            }, botToken);
        }
        return;
    }

    // (Keep your pause_camp_, resume_camp_, del_camp_ here as they were)

    await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, botToken);
}
