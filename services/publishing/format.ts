import type { CampaignStatus, ScheduleKind } from "@prisma/client";

/** JavaScript weekday numbers in Persian week order (Saturday first). */
export const PERSIAN_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "یکشنبه",
  1: "دوشنبه",
  2: "سه‌شنبه",
  3: "چهارشنبه",
  4: "پنجشنبه",
  5: "جمعه",
  6: "شنبه",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "فعال",
  PAUSED: "متوقف",
  COMPLETED: "پایان‌یافته",
};

export function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

export function faTime(time: string) {
  return time.replace(/\d/g, (digit) => faNumber(Number(digit)));
}

function joinFa(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("، ")} و ${items.at(-1)}`;
}

export function describeInterval(minutes: number) {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return days === 1 ? "هر روز" : `هر ${faNumber(days)} روز`;
  }
  if (minutes % 60 === 0) return `هر ${faNumber(minutes / 60)} ساعت`;
  return `هر ${faNumber(minutes)} دقیقه`;
}

export function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function describeSchedule(campaign: {
  scheduleKind: ScheduleKind;
  intervalMinutes: number | null;
  times: string[];
  weekdays: number[];
  startsAt: Date;
  timezone: string;
}) {
  switch (campaign.scheduleKind) {
    case "ONCE":
      return `یک‌بار، ${formatDateTime(campaign.startsAt, campaign.timezone)}`;
    case "INTERVAL":
      return describeInterval(campaign.intervalMinutes ?? 60);
    case "DAILY":
      return `هر روز ساعت ${joinFa(campaign.times.map(faTime))}`;
    case "WEEKLY": {
      const days = PERSIAN_WEEK_ORDER.filter((day) =>
        campaign.weekdays.includes(day),
      ).map((day) => `${WEEKDAY_LABELS[day]}‌ها`);
      return `${joinFa(days)} ساعت ${joinFa(campaign.times.map(faTime))}`;
    }
  }
}
