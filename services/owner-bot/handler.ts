/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Bot } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  dashboardPath,
  slugFromPlatform,
} from "@/services/bot-platforms/config";
import { getBotPlatformProvider } from "@/services/bot-platforms/provider";
import { appBaseUrl } from "@/services/bots/connection";
import {
  createCampaign,
  deleteCampaign,
  publishNow,
  runCampaignNow,
  setCampaignPaused,
  summarizeSend,
} from "@/services/publishing/campaigns";
import { capturePostFromMessage, postPreviewText } from "@/services/publishing/content";
import {
  checkDestination,
  DESTINATION_STATUS_LABELS,
} from "@/services/publishing/destinations";
import {
  CAMPAIGN_STATUS_LABELS,
  describeInterval,
  describeSchedule,
  faNumber,
  faTime,
  formatDateTime,
} from "@/services/publishing/format";
import {
  DEFAULT_TIME_ZONE,
  MAX_TIMES_PER_DAY,
  nextOccurrence,
  normalizeTimes,
} from "@/services/publishing/schedule";
import {
  clearAwaiting,
  createConversation,
  endConversation,
  findAwaitingPublish,
  getConversation,
  saveConversation,
  type Conversation,
  type PublishState,
} from "./state";

export type OwnerBot = Pick<
  Bot,
  "id" | "token" | "platform" | "username" | "ownerPlatformUserId"
>;

type Button = { text: string; callback_data?: string; url?: string };
type Keyboard = Button[][];

const PAGE_SIZE = 8;
const CAMPAIGN_PAGE_SIZE = 5;
const INTERVAL_PRESETS = [60, 120, 180, 360, 720, 1440, 2880, 10080];

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Accepts Persian/Arabic digits and Persian separators in typed times. */
export function parseTypedTimes(input: string) {
  const latin = input
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  return latin
    .split(/[\s,،;؛\-و]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^\d:\d\d$/.test(part) ? `0${part}` : part));
}

function dashboardUrl(bot: OwnerBot, suffix = "") {
  try {
    const url = `${appBaseUrl()}${dashboardPath(slugFromPlatform(bot.platform), `bots/${bot.id}${suffix}`)}`;
    return url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}

class Reply {
  private answered = false;

  constructor(
    private readonly bot: OwnerBot,
    private readonly chatId: string,
    private readonly callback?: any,
  ) {}

  call(method: string, payload: Record<string, unknown>) {
    return getBotPlatformProvider(this.bot.platform).call<any>(
      this.bot.token,
      method,
      payload,
    );
  }

  send(text: string, keyboard?: Keyboard, replyTo?: number) {
    return this.call("sendMessage", {
      chat_id: this.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  /** Edits the callback's message, or sends a new one outside callbacks. */
  async show(text: string, keyboard?: Keyboard) {
    if (!this.callback?.message) return this.send(text, keyboard);
    const response = await this.call("editMessageText", {
      chat_id: this.chatId,
      message_id: this.callback.message.message_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard ?? [] },
    });
    if (!response.ok && !String(response.description).includes("not modified")) {
      return this.send(text, keyboard);
    }
    return response;
  }

  async answer(text?: string, alert = false) {
    if (!this.callback || this.answered) return;
    this.answered = true;
    await this.call("answerCallbackQuery", {
      callback_query_id: this.callback.id,
      ...(text ? { text, show_alert: alert } : {}),
    });
  }
}

// ------------------------------------------------------------------ menus

function mainMenu(bot: OwnerBot): Keyboard {
  const url = dashboardUrl(bot);
  return [
    [
      { text: "📝 پست جدید", callback_data: "m:new" },
      { text: "📅 کمپین‌ها", callback_data: "c:l:0" },
    ],
    [
      { text: "📣 مقصدها", callback_data: "d:l" },
      { text: "📊 وضعیت", callback_data: "m:st" },
    ],
    ...(url ? [[{ text: "🌐 باز کردن داشبورد", url }]] : []),
    [{ text: "❓ راهنما", callback_data: "m:h" }],
  ];
}

const HOME_ROW: Button[] = [{ text: "🏠 منوی اصلی", callback_data: "m:home" }];

const MAIN_TEXT =
  "🤖 <b>پنل مدیریت ربات</b>\n\nبرای ساخت پست، کافی است متن، عکس، ویدیو یا فایل را همین‌جا بفرستید. سپس می‌توانید آن را فوری ارسال یا زمان‌بندی کنید.";

const HELP_TEXT = `📖 <b>راهنمای سریع</b>

<b>۱. افزودن مقصد</b>
ربات را به کانال یا گروه خود اضافه کنید. در کانال باید ربات <b>مدیر</b> باشد و اجازه «ارسال پیام» داشته باشد. بعد از اضافه شدن، همین‌جا پیام تأیید می‌گیرید.

<b>۲. ساخت پست</b>
محتوا را برای ربات بفرستید (متن، عکس، ویدیو، گیف، فایل یا صوت). قالب‌بندی متن حفظ می‌شود.

<b>۳. ارسال یا زمان‌بندی</b>
«ارسال فوری» یا «زمان‌بندی» را بزنید، مقصدها را انتخاب کنید و زمان را مشخص کنید: هر روز در ساعت‌های مشخص، هر چند ساعت یک‌بار، یا یک‌بار.

<b>۴. پیگیری</b>
از «کمپین‌ها» ارسال‌ها را متوقف، فعال، فوری اجرا یا حذف کنید. نتیجه هر ارسال در داشبورد ثبت می‌شود.

ساعت‌ها به وقت تهران هستند. برای لغو هر مرحله /cancel را بفرستید.`;

// ------------------------------------------------------------------ messages

export async function handleOwnerMessage(bot: OwnerBot, message: any) {
  if (message?.chat?.type !== "private") return;
  const chatId = String(message.chat.id);
  const reply = new Reply(bot, chatId);
  const text: string | undefined = message.text?.trim();
  const command = text?.startsWith("/")
    ? text.split(/\s+/, 1)[0].split("@", 1)[0].toLowerCase()
    : null;

  if (command === "/start" || command === "/admin" || command === "/menu") {
    await clearAwaiting(bot.id, chatId);
    await reply.send(MAIN_TEXT, mainMenu(bot));
    return;
  }
  if (command === "/cancel") {
    const cleared = await clearAwaiting(bot.id, chatId);
    await reply.send(cleared ? "❌ مرحله فعلی لغو شد." : "کاری برای لغو وجود ندارد.", [HOME_ROW]);
    return;
  }
  if (command === "/help") {
    await reply.send(HELP_TEXT, [HOME_ROW]);
    return;
  }
  if (command === "/campaigns") {
    await showCampaigns(bot, reply, 0);
    return;
  }

  const awaiting = text ? await findAwaitingPublish(bot.id, chatId) : null;
  if (awaiting && text) {
    await handleTypedSchedule(bot, reply, awaiting, text);
    return;
  }

  if (command) {
    await reply.send("این دستور شناخته نشد.", mainMenu(bot));
    return;
  }

  const captured = capturePostFromMessage(message);
  if (!captured) {
    await reply.send(
      "این نوع پیام قابل انتشار نیست. متن، عکس، ویدیو، گیف، فایل یا صوت بفرستید.",
      undefined,
      message.message_id,
    );
    return;
  }

  const post = await prisma.post.create({
    data: { botId: bot.id, ...captured },
    select: { id: true },
  });
  const conversation = await createConversation<PublishState>(bot.id, chatId, "publish", {
    postId: post.id,
    mode: "now",
    options: [],
    selected: [],
    page: 0,
    awaiting: null,
    schedule: null,
  });
  const albumNote = message.media_group_id
    ? "\n\nℹ️ هر فایل آلبوم به‌صورت یک پست جداگانه ذخیره می‌شود."
    : "";

  await reply.send(
    `📌 پست ذخیره شد. با آن چه کنیم؟${albumNote}`,
    [
      [
        { text: "🚀 ارسال فوری", callback_data: `p:now:${conversation.id}` },
        { text: "📅 زمان‌بندی", callback_data: `p:sch:${conversation.id}` },
      ],
      [{ text: "🗑 حذف پیش‌نویس", callback_data: `p:x:${conversation.id}` }],
    ],
    message.message_id,
  );
}

async function handleTypedSchedule(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
  text: string,
) {
  const times = parseTypedTimes(text);
  const valid = normalizeTimes(times);
  const state = conversation.data;

  if (!times.length || valid.length !== new Set(times).size) {
    await reply.send(
      "⚠️ قالب ساعت درست نیست. ساعت را ۲۴ساعته بفرستید، مثل <code>09:00</code> یا <code>18:30</code>.\nبرای لغو /cancel را بفرستید.",
    );
    return;
  }

  if (state.awaiting === "times") {
    if (valid.length > MAX_TIMES_PER_DAY) {
      await reply.send(`⚠️ حداکثر ${faNumber(MAX_TIMES_PER_DAY)} ساعت در روز مجاز است.`);
      return;
    }
    state.schedule = { kind: "DAILY", times: valid };
  } else {
    if (valid.length !== 1) {
      await reply.send("⚠️ فقط یک ساعت بفرستید، مثل <code>21:30</code>.");
      return;
    }
    const at = nextOccurrence(
      {
        scheduleKind: "DAILY",
        intervalMinutes: null,
        times: valid,
        weekdays: [],
        timezone: DEFAULT_TIME_ZONE,
        startsAt: new Date(),
        endsAt: null,
        maxRuns: null,
        runCount: 0,
      },
      new Date(),
    )!;
    state.schedule = { kind: "ONCE", at: at.toISOString() };
  }

  state.awaiting = null;
  await saveConversation(bot.id, conversation);
  await showConfirmation(bot, reply, conversation);
}

// ------------------------------------------------------------------ callbacks

export async function handleOwnerCallback(bot: OwnerBot, callback: any) {
  const chatId = String(callback.message?.chat?.id ?? callback.from?.id);
  const reply = new Reply(bot, chatId, callback);
  const [scope, action, arg, extra] = String(callback.data ?? "").split(":");

  try {
    if (scope === "m") await handleMenu(bot, reply, action);
    else if (scope === "p") await handlePublish(bot, reply, chatId, action, arg, extra);
    else if (scope === "c") await handleCampaignAction(bot, reply, action, arg);
    else if (scope === "d") await handleDestinationAction(bot, reply, action, arg);
    else await reply.show("این منو قدیمی است. از منوی جدید استفاده کنید.", mainMenu(bot));
  } catch (error) {
    console.error("[owner-bot] callback failed", error);
    await reply.answer("خطایی رخ داد. دوباره تلاش کنید.", true);
  } finally {
    await reply.answer();
  }
}

async function handleMenu(bot: OwnerBot, reply: Reply, action: string) {
  if (action === "home") await reply.show(MAIN_TEXT, mainMenu(bot));
  else if (action === "h") await reply.show(HELP_TEXT, [HOME_ROW]);
  else if (action === "st") await showStatus(bot, reply);
  else if (action === "new") {
    await reply.show(
      "✍️ محتوای پست را همین‌جا بفرستید: متن، عکس، ویدیو، گیف، فایل یا صوت.\nقالب‌بندی متن و توضیح عکس حفظ می‌شود.",
      [HOME_ROW],
    );
  }
}

async function loadPublish(bot: OwnerBot, reply: Reply, chatId: string, id: string) {
  const conversation = await getConversation<PublishState>(bot.id, chatId, id, "publish");
  if (!conversation) {
    await reply.show("⌛️ این مرحله منقضی شده است. پست را دوباره بفرستید.", [HOME_ROW]);
  }
  return conversation;
}

async function handlePublish(
  bot: OwnerBot,
  reply: Reply,
  chatId: string,
  action: string,
  id: string,
  extra?: string,
) {
  const conversation = await loadPublish(bot, reply, chatId, id);
  if (!conversation) return;
  const state = conversation.data;

  switch (action) {
    case "now":
    case "sch":
    case "ref": {
      if (action !== "ref") state.mode = action === "now" ? "now" : "schedule";
      const destinations = await prisma.connectedChat.findMany({
        where: { botId: bot.id, status: "ACTIVE" },
        orderBy: { chatTitle: "asc" },
        select: { id: true },
      });
      state.options = destinations.map((destination) => destination.id);
      state.selected = state.selected.filter((item) => state.options.includes(item));
      if (state.options.length === 1) state.selected = [...state.options];
      state.page = 0;
      await saveConversation(bot.id, conversation);
      return showPicker(bot, reply, conversation);
    }
    case "t": {
      const destinationId = state.options[Number(extra)];
      if (destinationId) {
        state.selected = state.selected.includes(destinationId)
          ? state.selected.filter((item) => item !== destinationId)
          : [...state.selected, destinationId];
        await saveConversation(bot.id, conversation);
      }
      return showPicker(bot, reply, conversation);
    }
    case "all":
      state.selected =
        state.selected.length === state.options.length ? [] : [...state.options];
      await saveConversation(bot.id, conversation);
      return showPicker(bot, reply, conversation);
    case "pg":
      state.page = Math.max(0, Number(extra) || 0);
      await saveConversation(bot.id, conversation);
      return showPicker(bot, reply, conversation);
    case "ok": {
      if (!state.selected.length) {
        return reply.answer("حداقل یک مقصد را انتخاب کنید.", true);
      }
      if (state.mode === "now") return sendNow(bot, reply, conversation);
      return showSchedulePicker(bot, reply, conversation);
    }
    case "ivm":
      return reply.show("🔁 هر چند وقت یک‌بار ارسال شود؟", [
        ...chunk(
          INTERVAL_PRESETS.map((minutes) => ({
            text: describeInterval(minutes),
            callback_data: `p:iv:${conversation.id}:${minutes}`,
          })),
          2,
        ),
        [{ text: "🔙 بازگشت", callback_data: `p:ok:${conversation.id}` }],
      ]);
    case "iv": {
      const minutes = Number(extra);
      if (!INTERVAL_PRESETS.includes(minutes)) return;
      state.schedule = { kind: "INTERVAL", minutes };
      await saveConversation(bot.id, conversation);
      return showConfirmation(bot, reply, conversation);
    }
    case "daily":
    case "once":
      state.awaiting = action === "daily" ? "times" : "once";
      await saveConversation(bot.id, conversation);
      return reply.show(
        action === "daily"
          ? "🕘 ساعت‌های ارسال روزانه را بفرستید (به وقت تهران).\nمثال: <code>09:00, 18:30</code>\n\nبرای لغو /cancel را بفرستید."
          : "⏰ ساعت ارسال را بفرستید (به وقت تهران)، مثل <code>21:30</code>.\nاگر این ساعت امروز گذشته باشد، فردا ارسال می‌شود.\n\nبرای لغو /cancel را بفرستید.",
        [[{ text: "🔙 بازگشت", callback_data: `p:ok:${conversation.id}` }]],
      );
    case "cf":
      return confirmSchedule(bot, reply, conversation);
    case "x": {
      await endConversation(bot.id, conversation.id);
      const removed = await prisma.post.deleteMany({
        where: { id: state.postId, botId: bot.id, campaigns: { none: {} } },
      });
      return reply.show(
        removed.count ? "🗑 پیش‌نویس حذف شد." : "❌ عملیات لغو شد.",
        [HOME_ROW],
      );
    }
  }
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

async function showPicker(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
) {
  const state = conversation.data;
  const id = conversation.id;
  const unavailable = await prisma.connectedChat.count({
    where: { botId: bot.id, status: { not: "ACTIVE" } },
  });

  if (!state.options.length) {
    return reply.show(
      `📭 هنوز مقصد آماده‌ای ندارید.\n\nربات <b>@${esc(bot.username)}</b> را به کانال یا گروه خود اضافه کنید (در کانال باید مدیر با اجازه ارسال پیام باشد)، سپس «بررسی دوباره» را بزنید.` +
        (unavailable ? `\n\n⚠️ ${faNumber(unavailable)} مقصد به دلیل نداشتن دسترسی قابل انتخاب نیست.` : ""),
      [
        [{ text: "🔄 بررسی دوباره", callback_data: `p:ref:${id}` }],
        [{ text: "❌ لغو", callback_data: `p:x:${id}` }],
      ],
    );
  }

  const pages = Math.ceil(state.options.length / PAGE_SIZE);
  const page = Math.min(state.page, pages - 1);
  const pageIds = state.options.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const destinations = await prisma.connectedChat.findMany({
    where: { id: { in: pageIds }, botId: bot.id },
    select: { id: true, chatTitle: true },
  });
  const titles = new Map(destinations.map((item) => [item.id, item.chatTitle]));

  const keyboard: Keyboard = pageIds.map((destinationId, offset) => [
    {
      text: `${state.selected.includes(destinationId) ? "✅" : "⬜️"} ${titles.get(destinationId) ?? "مقصد"}`,
      callback_data: `p:t:${id}:${page * PAGE_SIZE + offset}`,
    },
  ]);
  if (pages > 1) {
    keyboard.push([
      ...(page > 0 ? [{ text: "▶️ قبلی", callback_data: `p:pg:${id}:${page - 1}` }] : []),
      { text: `${faNumber(page + 1)} از ${faNumber(pages)}`, callback_data: `p:pg:${id}:${page}` },
      ...(page < pages - 1 ? [{ text: "بعدی ◀️", callback_data: `p:pg:${id}:${page + 1}` }] : []),
    ]);
  }
  keyboard.push([
    {
      text: state.selected.length === state.options.length ? "⬜️ لغو انتخاب همه" : "☑️ انتخاب همه",
      callback_data: `p:all:${id}`,
    },
  ]);
  keyboard.push([
    { text: `✅ ادامه (${faNumber(state.selected.length)})`, callback_data: `p:ok:${id}` },
    { text: "❌ لغو", callback_data: `p:x:${id}` },
  ]);

  const verb = state.mode === "now" ? "ارسال فوری" : "زمان‌بندی";
  await reply.show(
    `📣 مقصدهای ${verb} را انتخاب کنید:` +
      (unavailable
        ? `\n\n⚠️ ${faNumber(unavailable)} مقصد به دلیل نداشتن دسترسی نمایش داده نشده است. از «مقصدها» وضعیت آن‌ها را بررسی کنید.`
        : ""),
    keyboard,
  );
}

async function sendNow(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
) {
  await reply.answer("در حال ارسال…");
  await reply.show(`🚀 در حال ارسال به ${faNumber(conversation.data.selected.length)} مقصد…`);
  const result = await publishNow(bot.id, {
    postId: conversation.data.postId,
    destinationIds: conversation.data.selected,
  });
  await endConversation(bot.id, conversation.id);

  if (!result.ok) return reply.show(`❌ ${esc(result.error)}`, [HOME_ROW]);
  const { summary } = result.value;
  const failedHelp = summary.failed
    ? "\n\nعلت ارسال‌های ناموفق در «مقصدها» و داشبورد قابل مشاهده است."
    : "";
  await reply.show(`✅ ارسال انجام شد: ${summarizeSend(summary)}.${failedHelp}`, [
    [{ text: "📣 مقصدها", callback_data: "d:l" }],
    HOME_ROW,
  ]);
}

async function showSchedulePicker(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
) {
  const id = conversation.id;
  const url = dashboardUrl(bot);
  conversation.data.awaiting = null;
  await saveConversation(bot.id, conversation);
  await reply.show(`📅 چه زمانی به ${faNumber(conversation.data.selected.length)} مقصد ارسال شود؟`, [
    [{ text: "🕘 هر روز در ساعت‌های مشخص", callback_data: `p:daily:${id}` }],
    [{ text: "🔁 تکرار هر چند ساعت", callback_data: `p:ivm:${id}` }],
    [{ text: "⏰ یک‌بار در ساعت مشخص", callback_data: `p:once:${id}` }],
    ...(url ? [[{ text: "⚙️ روزهای هفته و تنظیمات بیشتر در داشبورد", url }]] : []),
    [
      { text: "🔙 مقصدها", callback_data: `p:ref:${id}` },
      { text: "❌ لغو", callback_data: `p:x:${id}` },
    ],
  ]);
}

function scheduleFields(state: PublishState) {
  const schedule = state.schedule!;
  if (schedule.kind === "DAILY") {
    return { scheduleKind: "DAILY" as const, times: schedule.times };
  }
  if (schedule.kind === "INTERVAL") {
    return { scheduleKind: "INTERVAL" as const, intervalMinutes: schedule.minutes };
  }
  return { scheduleKind: "ONCE" as const, startsAt: new Date(schedule.at) };
}

function scheduleText(state: PublishState) {
  const schedule = state.schedule!;
  if (schedule.kind === "DAILY") {
    return `هر روز ساعت ${schedule.times.map(faTime).join("، ")}`;
  }
  if (schedule.kind === "INTERVAL") {
    return `${describeInterval(schedule.minutes)}، از همین حالا`;
  }
  return `یک‌بار، ${formatDateTime(new Date(schedule.at), DEFAULT_TIME_ZONE)}`;
}

async function showConfirmation(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
) {
  const state = conversation.data;
  const post = await prisma.post.findFirst({
    where: { id: state.postId, botId: bot.id },
    select: { content: true, mediaType: true },
  });
  if (!post) return reply.show("پست پیدا نشد؛ دوباره آن را بفرستید.", [HOME_ROW]);

  await reply.show(
    `🧾 <b>بررسی نهایی</b>\n\n📝 ${esc(postPreviewText(post, 80))}\n📣 ${faNumber(state.selected.length)} مقصد\n⏱ ${scheduleText(state)}`,
    [
      [{ text: "✅ ثبت کمپین", callback_data: `p:cf:${conversation.id}` }],
      [
        { text: "✏️ تغییر زمان", callback_data: `p:ok:${conversation.id}` },
        { text: "❌ لغو", callback_data: `p:x:${conversation.id}` },
      ],
    ],
  );
}

async function confirmSchedule(
  bot: OwnerBot,
  reply: Reply,
  conversation: Conversation<PublishState>,
) {
  const state = conversation.data;
  if (!state.schedule) return showSchedulePicker(bot, reply, conversation);

  const result = await createCampaign(bot.id, {
    postId: state.postId,
    destinationIds: state.selected,
    ...scheduleFields(state),
  });
  if (!result.ok) return reply.show(`❌ ${esc(result.error)}`, [HOME_ROW]);

  await endConversation(bot.id, conversation.id);
  const campaign = await prisma.campaign.findUnique({
    where: { id: result.value.id },
    select: { nextRun: true, timezone: true },
  });
  await reply.show(
    `✅ کمپین ثبت شد.\n⏱ ${scheduleText(state)}\n` +
      (campaign?.nextRun
        ? `اولین ارسال: ${formatDateTime(campaign.nextRun, campaign.timezone)}`
        : ""),
    [[{ text: "📅 کمپین‌ها", callback_data: "c:l:0" }], HOME_ROW],
  );
}

// ------------------------------------------------------------------ campaigns

const STATUS_EMOJI = { ACTIVE: "🟢", PAUSED: "⏸", COMPLETED: "✔️" } as const;

async function showCampaigns(bot: OwnerBot, reply: Reply, page: number) {
  const where = { botId: bot.id, status: { not: "COMPLETED" as const } };
  const [total, completed] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.count({ where: { botId: bot.id, status: "COMPLETED" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / CAMPAIGN_PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: current * CAMPAIGN_PAGE_SIZE,
    take: CAMPAIGN_PAGE_SIZE,
    include: {
      post: { select: { content: true, mediaType: true } },
      _count: { select: { targets: true } },
    },
  });

  if (!campaigns.length) {
    return reply.show(
      "📭 کمپین فعالی ندارید.\nبرای ساخت کمپین، محتوای پست را برای ربات بفرستید." +
        (completed ? `\n\n${faNumber(completed)} کمپین پایان‌یافته در داشبورد قابل مشاهده است.` : ""),
      [HOME_ROW],
    );
  }

  const lines = campaigns.map((campaign, index) => {
    const number = faNumber(current * CAMPAIGN_PAGE_SIZE + index + 1);
    const title = campaign.name || postPreviewText(campaign.post, 40);
    const next =
      campaign.status === "ACTIVE" && campaign.nextRun
        ? `اجرای بعدی: ${formatDateTime(campaign.nextRun, campaign.timezone)}`
        : CAMPAIGN_STATUS_LABELS[campaign.status];
    return `${number}. ${STATUS_EMOJI[campaign.status]} <b>${esc(title)}</b>\n   ⏱ ${describeSchedule(campaign)}\n   📣 ${faNumber(campaign._count.targets)} مقصد · ${next}`;
  });

  const keyboard: Keyboard = campaigns.map((campaign, index) => {
    const number = faNumber(current * CAMPAIGN_PAGE_SIZE + index + 1);
    return [
      {
        text: campaign.status === "ACTIVE" ? `⏸ توقف ${number}` : `▶️ فعال ${number}`,
        callback_data: `c:p:${campaign.id}`,
      },
      { text: `🚀 اجرا ${number}`, callback_data: `c:r:${campaign.id}` },
      { text: `🗑 ${number}`, callback_data: `c:d:${campaign.id}` },
    ];
  });
  if (pages > 1) {
    keyboard.push([
      ...(current > 0 ? [{ text: "▶️ قبلی", callback_data: `c:l:${current - 1}` }] : []),
      ...(current < pages - 1 ? [{ text: "بعدی ◀️", callback_data: `c:l:${current + 1}` }] : []),
    ]);
  }
  keyboard.push(HOME_ROW);

  await reply.show(`📅 <b>کمپین‌ها</b>\n\n${lines.join("\n\n")}`, keyboard);
}

async function handleCampaignAction(
  bot: OwnerBot,
  reply: Reply,
  action: string,
  arg: string,
) {
  if (action === "l") return showCampaigns(bot, reply, Number(arg) || 0);

  const campaign = await prisma.campaign.findFirst({
    where: { id: arg, botId: bot.id },
    include: { post: { select: { content: true, mediaType: true } } },
  });
  if (!campaign) {
    await reply.answer("این کمپین پیدا نشد.", true);
    return showCampaigns(bot, reply, 0);
  }

  if (action === "p") {
    const result = await setCampaignPaused(bot.id, campaign.id, campaign.status === "ACTIVE");
    await reply.answer(
      result.ok
        ? result.value.status === "PAUSED"
          ? "⏸ کمپین متوقف شد."
          : "▶️ کمپین فعال شد."
        : result.error,
      !result.ok,
    );
    return showCampaigns(bot, reply, 0);
  }
  if (action === "r") {
    await reply.answer("در حال ارسال…");
    const result = await runCampaignNow(bot.id, campaign.id);
    await reply.send(result.ok ? `🚀 اجرای فوری: ${summarizeSend(result.value)}.` : `❌ ${esc(result.error)}`);
    return;
  }
  if (action === "d") {
    return reply.show(
      `🗑 کمپین «${esc(campaign.name || postPreviewText(campaign.post, 40))}» برای همیشه حذف شود؟\nتاریخچه ارسال‌های آن نیز حذف می‌شود.`,
      [
        [
          { text: "بله، حذف شود", callback_data: `c:dd:${campaign.id}` },
          { text: "انصراف", callback_data: "c:l:0" },
        ],
      ],
    );
  }
  if (action === "dd") {
    await deleteCampaign(bot.id, campaign.id);
    await reply.answer("کمپین حذف شد.");
    return showCampaigns(bot, reply, 0);
  }
}

// ------------------------------------------------------------------ destinations

const DESTINATION_EMOJI = { ACTIVE: "✅", NO_PERMISSION: "⚠️", REMOVED: "🚫" } as const;

async function showDestinations(bot: OwnerBot, reply: Reply) {
  const destinations = await prisma.connectedChat.findMany({
    where: { botId: bot.id },
    orderBy: [{ status: "asc" }, { chatTitle: "asc" }],
    take: 20,
  });
  const addHelp = `برای افزودن مقصد، ربات <b>@${esc(bot.username)}</b> را به کانال یا گروه اضافه کنید. در کانال، ربات باید مدیر با اجازه «ارسال پیام» باشد.`;

  if (!destinations.length) {
    return reply.show(`📭 هنوز مقصدی ندارید.\n\n${addHelp}`, [HOME_ROW]);
  }

  const lines = destinations.map(
    (destination, index) =>
      `${faNumber(index + 1)}. ${DESTINATION_EMOJI[destination.status]} ${esc(destination.chatTitle)} — ${DESTINATION_STATUS_LABELS[destination.status]}`,
  );
  const keyboard: Keyboard = destinations
    .filter((destination) => destination.status !== "REMOVED")
    .map((destination) => {
      const number = faNumber(destinations.indexOf(destination) + 1);
      return [
        { text: `🔄 بررسی ${number}`, callback_data: `d:c:${destination.id}` },
        { text: `🚪 خروج ${number}`, callback_data: `d:q:${destination.id}` },
      ];
    });
  keyboard.push(HOME_ROW);

  await reply.show(`📣 <b>مقصدها</b>\n\n${lines.join("\n")}\n\n${addHelp}`, keyboard);
}

async function handleDestinationAction(
  bot: OwnerBot,
  reply: Reply,
  action: string,
  arg: string,
) {
  if (action === "l") return showDestinations(bot, reply);

  const destination = await prisma.connectedChat.findFirst({
    where: { id: arg, botId: bot.id },
  });
  if (!destination) {
    await reply.answer("این مقصد پیدا نشد.", true);
    return showDestinations(bot, reply);
  }

  if (action === "c") {
    const checked = await checkDestination(bot, destination.id);
    await reply.answer(
      checked?.checkFailed
        ? "ارتباط با پیام‌رسان برقرار نشد؛ کمی بعد دوباره امتحان کنید."
        : `${destination.chatTitle}: ${DESTINATION_STATUS_LABELS[checked?.status ?? destination.status]}`,
      true,
    );
    return showDestinations(bot, reply);
  }
  if (action === "q") {
    return reply.show(
      `🚪 ربات از «${esc(destination.chatTitle)}» خارج شود؟\nکمپین‌ها دیگر به این مقصد ارسال نمی‌کنند.`,
      [
        [
          { text: "بله، خارج شود", callback_data: `d:qq:${destination.id}` },
          { text: "انصراف", callback_data: "d:l" },
        ],
      ],
    );
  }
  if (action === "qq") {
    await reply.call("leaveChat", { chat_id: destination.chatId });
    await prisma.connectedChat.update({
      where: { id: destination.id },
      data: { status: "REMOVED", statusReason: "خروج توسط مالک", lastCheckedAt: new Date() },
    });
    await reply.answer("ربات از مقصد خارج شد.");
    return showDestinations(bot, reply);
  }
}

// ------------------------------------------------------------------ status

async function showStatus(bot: OwnerBot, reply: Reply) {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [active, paused, needsAttention, sent, failed, upcoming] = await Promise.all([
    prisma.campaign.count({ where: { botId: bot.id, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { botId: bot.id, status: "PAUSED" } }),
    prisma.connectedChat.count({ where: { botId: bot.id, status: { not: "ACTIVE" } } }),
    prisma.delivery.count({ where: { botId: bot.id, status: "SENT", sentAt: { gte: since } } }),
    prisma.delivery.count({ where: { botId: bot.id, status: "FAILED", updatedAt: { gte: since } } }),
    prisma.campaign.findMany({
      where: { botId: bot.id, status: "ACTIVE", nextRun: { not: null } },
      orderBy: { nextRun: "asc" },
      take: 3,
      include: { post: { select: { content: true, mediaType: true } } },
    }),
  ]);

  const upcomingText = upcoming.length
    ? upcoming
        .map(
          (campaign) =>
            `• ${formatDateTime(campaign.nextRun!, campaign.timezone)} — ${esc(campaign.name || postPreviewText(campaign.post, 30))}`,
        )
        .join("\n")
    : "ارسال زمان‌بندی‌شده‌ای در پیش نیست.";

  await reply.show(
    `📊 <b>وضعیت</b>\n\n🟢 کمپین فعال: ${faNumber(active)}\n⏸ متوقف: ${faNumber(paused)}\n📬 ارسال موفق در ۲۴ ساعت گذشته: ${faNumber(sent)}\n❗️ ارسال ناموفق: ${faNumber(failed)}` +
      (needsAttention ? `\n⚠️ ${faNumber(needsAttention)} مقصد نیاز به بررسی دارد` : "") +
      `\n\n<b>ارسال‌های بعدی</b>\n${upcomingText}`,
    [
      ...(needsAttention ? [[{ text: "📣 بررسی مقصدها", callback_data: "d:l" }]] : []),
      HOME_ROW,
    ],
  );
}
