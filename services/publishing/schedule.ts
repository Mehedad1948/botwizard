import type { ScheduleKind } from "@prisma/client";

export const DEFAULT_TIME_ZONE = "Asia/Tehran";
export const MIN_INTERVAL_MINUTES = 60;
export const MAX_INTERVAL_MINUTES = 60 * 24 * 30;
export const MAX_JITTER_MINUTES = 60;
export const MAX_TIMES_PER_DAY = 12;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ScheduleInput = {
  scheduleKind: ScheduleKind;
  intervalMinutes: number | null;
  times: string[];
  weekdays: number[];
  timezone: string;
  startsAt: Date;
  endsAt: Date | null;
  maxRuns: number | null;
  runCount: number;
};

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(timeZone: string) {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function wallClock(date: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    weekday: WEEKDAY_INDEX[value("weekday")] ?? 0,
  };
}

function offsetMilliseconds(date: Date, timeZone: string) {
  const clock = wallClock(date, timeZone);
  const asUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
  return asUtc - date.getTime();
}

/** Converts a wall-clock time in `timeZone` to the UTC instant. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let result = naive - offsetMilliseconds(new Date(naive), timeZone);
  result = naive - offsetMilliseconds(new Date(result), timeZone);
  return new Date(result);
}

export function parseTime(time: string) {
  const match = TIME_PATTERN.exec(time.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function normalizeTimes(times: string[]) {
  return [
    ...new Set(
      times
        .map((time) => time.trim())
        .filter((time) => parseTime(time) !== null),
    ),
  ].sort();
}

function nextSlot(
  input: ScheduleInput,
  after: Date,
  weekdays: number[] | null,
): Date | null {
  const times = normalizeTimes(input.times);
  if (!times.length) return null;

  const lowerBound = Math.max(after.getTime(), input.startsAt.getTime() - 1);
  const start = wallClock(new Date(lowerBound), input.timezone);

  // Eight days always contains the next slot of a weekly schedule.
  for (let offset = 0; offset <= 8; offset += 1) {
    const day = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const weekday = day.getUTCDay();
    if (weekdays && !weekdays.includes(weekday)) continue;

    for (const time of times) {
      const { hour, minute } = parseTime(time)!;
      const candidate = zonedToUtc(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate(),
        hour,
        minute,
        input.timezone,
      );
      if (candidate.getTime() > lowerBound) return candidate;
    }
  }

  return null;
}

function rawNextOccurrence(input: ScheduleInput, after: Date): Date | null {
  switch (input.scheduleKind) {
    case "ONCE":
      return input.runCount === 0 && input.startsAt > after
        ? input.startsAt
        : null;
    case "INTERVAL": {
      const interval = (input.intervalMinutes ?? 0) * 60_000;
      if (interval <= 0) return null;
      const anchor = input.startsAt.getTime();
      if (anchor > after.getTime()) return input.startsAt;
      const steps = Math.floor((after.getTime() - anchor) / interval) + 1;
      return new Date(anchor + steps * interval);
    }
    case "DAILY":
      return nextSlot(input, after, null);
    case "WEEKLY":
      return input.weekdays.length
        ? nextSlot(input, after, input.weekdays)
        : null;
  }
}

/**
 * Next run strictly after `after`, honouring maxRuns and endsAt.
 * `runCount` must already include runs that happened at or before `after`.
 */
export function nextOccurrence(input: ScheduleInput, after: Date): Date | null {
  if (input.maxRuns !== null && input.runCount >= input.maxRuns) return null;
  const next = rawNextOccurrence(input, after);
  if (!next) return null;
  if (input.endsAt && next > input.endsAt) return null;
  return next;
}

/** First run for a newly created or re-activated campaign. */
export function firstOccurrence(input: ScheduleInput, now: Date): Date | null {
  if (input.scheduleKind === "ONCE" || input.scheduleKind === "INTERVAL") {
    if (input.runCount === 0 && input.startsAt <= now) {
      if (input.endsAt && now > input.endsAt) return null;
      return now;
    }
  }
  return nextOccurrence(input, new Date(now.getTime() - 1));
}

export type ScheduleValidationError = { field: string; message: string };

export function validateSchedule(
  input: ScheduleInput & { jitterMinutes: number },
): ScheduleValidationError | null {
  if (!isValidTimeZone(input.timezone)) {
    return { field: "timezone", message: "منطقه زمانی معتبر نیست." };
  }
  if (input.jitterMinutes < 0 || input.jitterMinutes > MAX_JITTER_MINUTES) {
    return {
      field: "jitterMinutes",
      message: `تأخیر تصادفی باید بین ۰ تا ${MAX_JITTER_MINUTES.toLocaleString("fa-IR")} دقیقه باشد.`,
    };
  }
  if (input.maxRuns !== null && input.maxRuns < 1) {
    return { field: "maxRuns", message: "تعداد دفعات اجرا باید حداقل ۱ باشد." };
  }
  if (input.endsAt && input.endsAt <= input.startsAt) {
    return { field: "endsAt", message: "زمان پایان باید بعد از زمان شروع باشد." };
  }

  if (input.scheduleKind === "INTERVAL") {
    const minutes = input.intervalMinutes;
    if (
      minutes === null ||
      !Number.isInteger(minutes) ||
      minutes < MIN_INTERVAL_MINUTES ||
      minutes > MAX_INTERVAL_MINUTES
    ) {
      return {
        field: "intervalMinutes",
        message: "فاصله تکرار باید حداقل ۱ ساعت و حداکثر ۳۰ روز باشد.",
      };
    }
  }

  if (input.scheduleKind === "DAILY" || input.scheduleKind === "WEEKLY") {
    const times = normalizeTimes(input.times);
    if (!times.length || times.length !== input.times.length) {
      return {
        field: "times",
        message: "ساعت‌ها را با قالب ۲۴ساعته مثل 09:00 وارد کنید.",
      };
    }
    if (times.length > MAX_TIMES_PER_DAY) {
      return {
        field: "times",
        message: `حداکثر ${MAX_TIMES_PER_DAY.toLocaleString("fa-IR")} ساعت در روز مجاز است.`,
      };
    }
  }

  if (input.scheduleKind === "WEEKLY") {
    if (
      !input.weekdays.length ||
      input.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      return { field: "weekdays", message: "حداقل یک روز هفته را انتخاب کنید." };
    }
  }

  return null;
}

/** Random delay in milliseconds within the campaign's jitter window. */
export function jitterMilliseconds(jitterMinutes: number, random = Math.random) {
  if (jitterMinutes <= 0) return 0;
  return Math.floor(random() * jitterMinutes * 60_000);
}
