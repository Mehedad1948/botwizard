import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import {
  firstOccurrence,
  nextOccurrence,
  validateSchedule,
  zonedToUtc,
  type ScheduleInput,
} from "@/services/publishing/schedule";
import { classifyDeliveryError, retryDelayMilliseconds } from "@/services/publishing/errors";
import {
  capturePostFromMessage,
  parseButtonLines,
  sendPost,
  type SendablePost,
} from "@/services/publishing/content";
import { describeSchedule } from "@/services/publishing/format";
import { statusFromChatMember } from "@/services/publishing/destinations";
import { parseTypedTimes } from "@/services/owner-bot/handler";
import type { BotPlatformProvider } from "@/services/bot-platforms/provider";

const TEHRAN = "Asia/Tehran";

function rule(overrides: Partial<ScheduleInput>): ScheduleInput {
  return {
    scheduleKind: "DAILY",
    intervalMinutes: null,
    times: [],
    weekdays: [],
    timezone: TEHRAN,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: null,
    maxRuns: null,
    runCount: 0,
    ...overrides,
  };
}

describe("schedule", () => {
  it("converts Tehran wall clock to UTC (+03:30)", () => {
    expect(zonedToUtc(2026, 11, 9, 9, 0, TEHRAN).toISOString()).toBe(
      "2026-11-09T05:30:00.000Z",
    );
  });

  it("picks the next daily time later today", () => {
    // 12:00 Tehran
    const now = new Date("2026-11-09T08:30:00Z");
    const next = nextOccurrence(rule({ times: ["09:00", "18:30"] }), now);
    expect(next?.toISOString()).toBe("2026-11-09T15:00:00.000Z");
  });

  it("rolls daily times over to tomorrow", () => {
    // 20:00 Tehran
    const now = new Date("2026-11-09T16:30:00Z");
    const next = nextOccurrence(rule({ times: ["09:00", "18:30"] }), now);
    expect(next?.toISOString()).toBe("2026-11-10T05:30:00.000Z");
  });

  it("finds the next allowed weekday", () => {
    // Monday 2026-11-09, 12:00 Tehran. Saturday = 6.
    const now = new Date("2026-11-09T08:30:00Z");
    const next = nextOccurrence(
      rule({ scheduleKind: "WEEKLY", times: ["10:00"], weekdays: [6] }),
      now,
    );
    expect(next?.toISOString()).toBe("2026-11-14T06:30:00.000Z");
  });

  it("keeps interval runs on the anchor grid and skips missed runs", () => {
    const startsAt = new Date("2026-11-09T00:00:00Z");
    const input = rule({ scheduleKind: "INTERVAL", intervalMinutes: 120, startsAt, runCount: 1 });
    // Five hours late: the next run is the next grid point, not a burst.
    const next = nextOccurrence(input, new Date("2026-11-09T05:00:00Z"));
    expect(next?.toISOString()).toBe("2026-11-09T06:00:00.000Z");
  });

  it("completes one-off campaigns after their run", () => {
    const startsAt = new Date("2026-11-09T10:00:00Z");
    expect(nextOccurrence(rule({ scheduleKind: "ONCE", startsAt, runCount: 1 }), startsAt)).toBeNull();
  });

  it("starts past one-off and interval campaigns immediately", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    const input = rule({ scheduleKind: "ONCE", startsAt: new Date("2026-11-09T09:00:00Z") });
    expect(firstOccurrence(input, now)).toEqual(now);
  });

  it("honours maxRuns and endsAt", () => {
    const now = new Date("2026-11-09T08:30:00Z");
    expect(nextOccurrence(rule({ times: ["09:00"], maxRuns: 2, runCount: 2 }), now)).toBeNull();
    expect(
      nextOccurrence(rule({ times: ["18:30"], endsAt: new Date("2026-11-09T10:00:00Z") }), now),
    ).toBeNull();
  });

  it("validates input", () => {
    expect(validateSchedule({ ...rule({ scheduleKind: "INTERVAL", intervalMinutes: 30 }), jitterMinutes: 0 })?.field).toBe("intervalMinutes");
    expect(validateSchedule({ ...rule({ times: ["25:00"] }), jitterMinutes: 0 })?.field).toBe("times");
    expect(validateSchedule({ ...rule({ scheduleKind: "WEEKLY", times: ["10:00"] }), jitterMinutes: 0 })?.field).toBe("weekdays");
    expect(validateSchedule({ ...rule({ times: ["10:00"] }), jitterMinutes: 90 })?.field).toBe("jitterMinutes");
    expect(validateSchedule({ ...rule({ times: ["10:00"] }), jitterMinutes: 10 })).toBeNull();
  });

  it("describes schedules in Persian", () => {
    expect(describeSchedule(rule({ scheduleKind: "INTERVAL", intervalMinutes: 360 }))).toBe("هر ۶ ساعت");
    expect(describeSchedule(rule({ times: ["09:00", "18:30"] }))).toBe("هر روز ساعت ۰۹:۰۰ و ۱۸:۳۰");
    expect(
      describeSchedule(rule({ scheduleKind: "WEEKLY", times: ["10:00"], weekdays: [1, 6] })),
    ).toBe("شنبه‌ها و دوشنبه‌ها ساعت ۱۰:۰۰");
  });
});

describe("delivery errors", () => {
  it.each([
    ["Bad Request: not enough rights to send text messages to the chat", "NO_PERMISSION"],
    ["Bad Request: need administrator rights in the channel chat", "NO_PERMISSION"],
    ["Forbidden: bot was kicked from the group chat", "REMOVED"],
    ["Forbidden: bot is not a member of the channel chat", "REMOVED"],
    ["Bad Request: chat not found", "REMOVED"],
    ["Bad Request: message to copy not found", "CONTENT_MISSING"],
    ["Forbidden: bot was blocked by the user", "BLOCKED"],
  ])("classifies %s", (description, kind) => {
    expect(classifyDeliveryError({ description, error_code: 400 }).kind).toBe(kind);
  });

  it("treats 429 and 5xx as retryable", () => {
    const limited = classifyDeliveryError({
      description: "Too Many Requests: retry after 7",
      error_code: 429,
      parameters: { retry_after: 7 },
    });
    expect(limited).toMatchObject({ kind: "RATE_LIMITED", retryAfterSeconds: 7 });
    expect(classifyDeliveryError({ description: "Bad Gateway", error_code: 502 }).kind).toBe("TRANSIENT");
    expect(retryDelayMilliseconds(1, 7)).toBe(8000);
    expect(retryDelayMilliseconds(3)).toBe(240_000);
  });

  it("removes bot tokens from details", () => {
    const error = classifyDeliveryError({ description: "failed for bot123456:ABCdefGhIJklmnOPqrSTuvWXyz_12345" });
    expect(error.detail).not.toContain("ABCdef");
  });
});

describe("content", () => {
  it("captures photo file ids, captions and entities", () => {
    const captured = capturePostFromMessage({
      chat: { id: 5 },
      message_id: 9,
      caption: "سلام",
      caption_entities: [{ type: "bold", offset: 0, length: 4 }],
      photo: [{ file_id: "small" }, { file_id: "large" }],
    });
    expect(captured).toMatchObject({
      mediaType: "IMAGE",
      mediaFileId: "large",
      content: "سلام",
      sourceMessageId: 9,
    });
  });

  it("prefers animation over its document twin and rejects stickers", () => {
    expect(
      capturePostFromMessage({
        chat: { id: 5 },
        message_id: 1,
        animation: { file_id: "gif" },
        document: { file_id: "doc" },
      })?.mediaType,
    ).toBe("ANIMATION");
    expect(capturePostFromMessage({ chat: { id: 5 }, message_id: 1, sticker: {} })).toBeNull();
  });

  it("parses button lines", () => {
    expect(parseButtonLines("خرید | https://shop.ir\nکانال|https://t.me/x").buttons).toEqual([
      [{ text: "خرید", url: "https://shop.ir" }],
      [{ text: "کانال", url: "https://t.me/x" }],
    ]);
    expect(parseButtonLines("bad line").error).toBeTruthy();
    expect(parseButtonLines("x | javascript:alert(1)").error).toBeTruthy();
  });

  function fakeProvider(responses: Record<string, unknown>[]) {
    const calls: { method: string; payload: Record<string, unknown> }[] = [];
    const provider = {
      platform: "TELEGRAM",
      call: vi.fn(async (_token: string, method: string, payload: Record<string, unknown>) => {
        calls.push({ method, payload });
        return responses.shift() ?? { ok: true, result: { message_id: 1 } };
      }),
    } as unknown as BotPlatformProvider;
    return { provider, calls };
  }

  const base: SendablePost = {
    content: "hello",
    entities: null,
    mediaType: "NONE",
    mediaFileId: null,
    buttons: null,
    sourceChatId: "5",
    sourceMessageId: 9,
  };

  it("sends stored media with buttons", async () => {
    const { provider, calls } = fakeProvider([]);
    await sendPost(provider, "t", "-100", {
      ...base,
      mediaType: "VIDEO",
      mediaFileId: "vid",
      entities: [],
      buttons: [[{ text: "x", url: "https://x.ir" }]],
    });
    expect(calls[0]).toMatchObject({
      method: "sendVideo",
      payload: { video: "vid", caption: "hello", reply_markup: { inline_keyboard: [[{ text: "x", url: "https://x.ir" }]] } },
    });
  });

  it("falls back to stored text when a legacy source message is gone", async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error_code: 400, description: "Bad Request: message to copy not found" },
    ]);
    const result = await sendPost(provider, "t", "-100", base);
    expect(calls.map((call) => call.method)).toEqual(["copyMessage", "sendMessage"]);
    expect(result.ok).toBe(true);
  });

  it("does not retry other strategies on permission errors", async () => {
    const { provider, calls } = fakeProvider([
      { ok: false, error_code: 403, description: "Forbidden: bot was kicked from the channel chat" },
    ]);
    const result = await sendPost(provider, "t", "-100", base);
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, error: { kind: "REMOVED" } });
  });
});

describe("destinations", () => {
  it("derives posting ability from chat member state", () => {
    expect(statusFromChatMember({ status: "administrator", can_post_messages: true }, "CHANNEL")).toBe("ACTIVE");
    expect(statusFromChatMember({ status: "administrator", can_post_messages: false }, "CHANNEL")).toBe("NO_PERMISSION");
    expect(statusFromChatMember({ status: "member" }, "CHANNEL")).toBe("NO_PERMISSION");
    expect(statusFromChatMember({ status: "member" }, "SUPERGROUP")).toBe("ACTIVE");
    expect(statusFromChatMember({ status: "kicked" }, "SUPERGROUP")).toBe("REMOVED");
  });
});

describe("owner bot", () => {
  it("parses typed times in Persian digits and separators", () => {
    expect(parseTypedTimes("۹:۰۰، ۱۸:۳۰")).toEqual(["09:00", "18:30"]);
    expect(parseTypedTimes("10:00 و 22:15")).toEqual(["10:00", "22:15"]);
  });
});
