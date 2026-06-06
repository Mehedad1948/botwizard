// src/lib/telegram/handlers/callback.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { callTelegramAPI } from "../api";
import { Bot } from "@prisma/client";
import { handleCampaignsCommand } from "./campaigns";

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
            // ... (منطق ارسال فوری بدون تغییر باقی می‌ماند) ...
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `🚀 در حال ارسال به ${selectedChatIds.length} گروه...\nلطفاً شکیبا باشید.`
            }, bot.token);

            let successCount = 0; let failCount = 0;
            for (const targetChatId of selectedChatIds) {
                try {
                    const response = await callTelegramAPI("copyMessage", {
                        chat_id: targetChatId, from_chat_id: chatId, message_id: parseInt(draftId, 10),
                    }, bot.token);
                    if (response && response.ok) successCount++; else failCount++;
                } catch (e) { failCount++; }
            }
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ ارسال فوری پایان یافت!\n\n✔️ موفق: ${successCount} گروه\n❌ ناموفق: ${failCount} گروه`
            }, bot.token);
            return;
        }

        else if (action === "sch") {
            const joinedChats = selectedChatIds.join(",");
            // اضافه شدن انتخاب نوع زمان‌بندی
            const keyboard = [
                [{ text: "⏳ تکرار دوره‌ای (فاصله ثابت)", callback_data: `sti_${draftId}?c=${joinedChats}`.substring(0, 64) }],
                [{ text: "🕒 ارسال در ساعات خاص", callback_data: `sts_${draftId}?c=${joinedChats}`.substring(0, 64) }],
                [{ text: "🔙 لغو", callback_data: "cancel_draft" }]
            ];

            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: `✅ ${selectedChatIds.length} گروه انتخاب شد.\nنوع زمان‌بندی را انتخاب کنید:`,
                reply_markup: { inline_keyboard: keyboard }
            }, bot.token);
            return;
        }
    }

    // 5. انتخاب نوع زمان‌بندی: تکرار دوره‌ای
    if (data.startsWith("sti_")) {
        const draftId = data.split("_")[1].split("?")[0];
        const chatIdsString = data.split("?c=")[1];

        const intervals = [
            { label: "هر ۲ ساعت", hours: 2 },
            { label: "هر ۱۲ ساعت", hours: 12 },
            { label: "هر ۲۴ ساعت", hours: 24 },
        ];

        const keyboard = intervals.map(inv => (
            [{ text: `⏳ ${inv.label}`, callback_data: `si_${draftId}_${inv.hours}?c=${chatIdsString}`.substring(0, 64) }]
        ));
        keyboard.push([{ text: "🔙 لغو", callback_data: "cancel_draft" }]);

        await callTelegramAPI("editMessageText", {
            chat_id: chatId, message_id: messageId,
            text: `بازه زمانی تکرار دوره‌ای را انتخاب کنید:`,
            reply_markup: { inline_keyboard: keyboard }
        }, bot.token);
        return;
    }

    // 6. انتخاب نوع زمان‌بندی: ساعات خاص
    if (data.startsWith("sts_")) {
        const draftId = data.split("_")[1].split("?")[0];
        const chatIdsString = data.split("?c=")[1];

        // ارسال پیام با force_reply برای دریافت ساعات
        await callTelegramAPI("sendMessage", {
            chat_id: chatId,
            text: `🕒 لطفاً ساعات مورد نظر خود را با فرمت HH:MM و با کاما جدا کرده و ارسال کنید.\n\nمثال: 10:00, 14:30, 22:00\n\n#SchData_${draftId}_${chatIdsString}`,
            reply_markup: { force_reply: true }
        }, bot.token);

        await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, bot.token);
        return;
    }

    // 7. Interval Selected -> Save Campaigns
    if (data.startsWith("si_")) {
        const hoursPart = data.split("_")[2].split("?")[0];
        const intervalNum = parseInt(hoursPart);
        const chatIdsString = data.split("?c=")[1];
        const targetGroups = chatIdsString.split(",");

        try {
            const latestPost = await prisma.post.findFirst({
                where: { botId: bot.id },
                orderBy: { createdAt: 'desc' }
            });

            if (!latestPost) throw new Error("Post not found");

            // --- اضافه شده: دریافت نام گروه‌ها از دیتابیس ---
            const connectedChats = await prisma.connectedChat.findMany({
                where: { botId: bot.id, chatId: { in: targetGroups } }
            });
            const chatTitleMap = new Map(connectedChats.map(c => [c.chatId, c.chatTitle]));
            // ------------------------------------------------

            for (const tId of targetGroups) {
                await prisma.campaign.create({
                    data: {
                        botId: bot.id,
                        postId: latestPost.id,
                        chatId: tId,
                        chatTitle: chatTitleMap.get(tId) || "گروه ناشناس", // <-- اصلاح شد
                        scheduleType: "INTERVAL",
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
            console.error("Error creating interval campaigns:", error);
            await callTelegramAPI("editMessageText", {
                chat_id: chatId, message_id: messageId,
                text: "❌ خطایی در ذخیره کمپین رخ داد."
            }, bot.token);
        }
        return;
    }

    if (data === "close_menu") {
        await callTelegramAPI("deleteMessage", {
            chat_id: chatId,
            message_id: messageId
        }, bot.token);
        return;
    }

    // 9. حذف کمپین
    if (data.startsWith("del_camp_")) {
        const campId = data.replace("del_camp_", "");
        try {
            await prisma.campaign.delete({ where: { id: campId } });

            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "✅ کمپین با موفقیت حذف شد.",
            }, bot.token);

            // رفرش کردن لیست کمپین‌ها در همان پیام
            await handleCampaignsCommand(callback_query, bot, messageId);
        } catch (error) {
            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "❌ خطا در حذف کمپین.",
                show_alert: true
            }, bot.token);
        }
        return;
    }

    // 10. توقف/فعال‌سازی کمپین
    if (data.startsWith("tgl_camp_")) {
        const campId = data.replace("tgl_camp_", "");
        try {
            const camp = await prisma.campaign.findUnique({ where: { id: campId } });
            if (camp) {
                await prisma.campaign.update({
                    where: { id: campId },
                    data: { isActive: !camp.isActive }
                });

                await callTelegramAPI("answerCallbackQuery", {
                    callback_query_id: callback_query.id,
                    text: !camp.isActive ? "✅ کمپین فعال شد." : "⏸ کمپین متوقف شد.",
                }, bot.token);

                // رفرش کردن لیست
                await handleCampaignsCommand(callback_query, bot, messageId);
            }
        } catch (error) {
            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "❌ خطا در تغییر وضعیت کمپین.",
                show_alert: true
            }, bot.token);
        }
        return;
    }

        // 11. مشاهده محتوای پست
    if (data.startsWith("view_post_")) {
        const postId = data.replace("view_post_", "");
        try {
            const post = await prisma.post.findUnique({ where: { id: postId } });
            
            if (post) {
                await callTelegramAPI("sendMessage", {
                    chat_id: chatId,
                    text: `📝 **محتوای پست شما:**\n\n${post.content}`,
                    parse_mode: "Markdown"
                }, bot.token);
            } else {
                await callTelegramAPI("answerCallbackQuery", {
                    callback_query_id: callback_query.id,
                    text: "❌ پست پیدا نشد.",
                    show_alert: true
                }, bot.token);
                return;
            }
        } catch (error) {
            console.error("Error viewing post:", error);
        }
        
        await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, bot.token);
        return;
    }

        // 12. خروج ربات فرزند از یک گروه خاص
    if (data.startsWith("leave_chat_")) {
        const targetChatId = data.replace("leave_chat_", "");
        try {
            // ۱. ارسال دستور خروج به تلگرام
            await callTelegramAPI("leaveChat", { chat_id: targetChatId }, bot.token);

            // ۲. حذف از دیتابیس و توقف کمپین‌های آن گروه
            await prisma.connectedChat.deleteMany({
                where: { botId: bot.id, chatId: targetChatId }
            });
            await prisma.campaign.updateMany({
                where: { botId: bot.id, chatId: targetChatId },
                data: { isActive: false }
            });

            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "✅ ربات با موفقیت از گروه خارج شد.",
                show_alert: true
            }, bot.token);

            // ۳. رفرش کردن لیست گروه‌ها
            const { handleChatsCommand } = await import("./chats");
            await handleChatsCommand(callback_query, bot, messageId);
        } catch (error) {
            console.error("Error leaving chat:", error);
            await callTelegramAPI("answerCallbackQuery", {
                callback_query_id: callback_query.id,
                text: "❌ خطا در خروج از گروه (شاید ربات قبلاً حذف شده باشد).",
                show_alert: true
            }, bot.token);
        }
        return;
    }


    await callTelegramAPI("answerCallbackQuery", { callback_query_id: callback_query.id }, bot.token);
}
