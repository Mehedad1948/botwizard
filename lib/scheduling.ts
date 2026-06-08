export const CAMPAIGN_TIME_ZONE = "Asia/Tehran";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const tehranDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPAIGN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getTehranDateParts(date: Date): ZonedDateParts {
  const parts = tehranDateTimeFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffsetMilliseconds(date: Date): number {
  const parts = getTehranDateParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return representedAsUtc - date.getTime();
}

function tehranWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let result = new Date(
    wallClockAsUtc -
      getTimeZoneOffsetMilliseconds(new Date(wallClockAsUtc))
  );

  const correctedOffset = getTimeZoneOffsetMilliseconds(result);
  result = new Date(wallClockAsUtc - correctedOffset);

  return result;
}

function addCalendarDay(parts: ZonedDateParts): ZonedDateParts {
  const nextDay = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1)
  );

  return {
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

export function calculateNextRunForSpecificTimes(
  times: string[],
  now: Date = new Date()
): Date {
  if (times.length === 0) {
    throw new Error("At least one specific time is required.");
  }

  const sortedTimes = [...times].sort();
  const nowInTehran = getTehranDateParts(now);
  const currentMinutes = nowInTehran.hour * 60 + nowInTehran.minute;
  const nextTimeToday = sortedTimes.find((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute > currentMinutes;
  });
  const nextTime = nextTimeToday ?? sortedTimes[0];
  const targetDate = nextTimeToday ? nowInTehran : addCalendarDay(nowInTehran);
  const [hour, minute] = nextTime.split(":").map(Number);

  return tehranWallClockToUtc(
    targetDate.year,
    targetDate.month,
    targetDate.day,
    hour,
    minute
  );
}
