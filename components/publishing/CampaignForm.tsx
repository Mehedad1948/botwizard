"use client";

import { CalendarCheck, Loader2, Plus, Rocket, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

import {
  publishNowAction,
  saveCampaignAction,
} from "@/app/(dashboard)/dashboard/[platform]/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  dashboardPath,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import {
  describeInterval,
  faNumber,
  faTime,
  formatDateTime,
  PERSIAN_WEEK_ORDER,
  WEEKDAY_LABELS,
} from "@/services/publishing/format";
import { DEFAULT_TIME_ZONE, zonedToUtc } from "@/services/publishing/schedule";

type Mode = "NOW" | "ONCE" | "DAILY" | "WEEKLY" | "INTERVAL";

export type CampaignFormPost = { id: string; label: string; kind: string };
export type CampaignFormDestination = {
  id: string;
  title: string;
  typeLabel: string;
  status: "ACTIVE" | "NO_PERMISSION" | "REMOVED";
};
export type CampaignFormInitial = {
  campaignId: string;
  postId: string;
  destinationIds: string[];
  name: string;
  scheduleKind: Exclude<Mode, "NOW">;
  intervalMinutes: number | null;
  times: string[];
  weekdays: number[];
  startsAtLocal: string;
  endsAtLocal: string;
  maxRuns: number | null;
  jitterMinutes: number;
  notifySubscribers: boolean;
};

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "NOW", label: "همین حالا", hint: "یک‌بار، فوری" },
  { value: "ONCE", label: "یک‌بار", hint: "در زمان مشخص" },
  { value: "DAILY", label: "روزانه", hint: "ساعت‌های ثابت" },
  { value: "WEEKLY", label: "هفتگی", hint: "روزهای منتخب" },
  { value: "INTERVAL", label: "تکرار", hint: "هر چند ساعت" },
];

const JITTER_OPTIONS = [0, 5, 15, 30, 60];

function localToDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return zonedToUtc(year, month, day, hour, minute, DEFAULT_TIME_ZONE);
}

function joinFa(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("، ")} و ${items.at(-1)}`;
}

export function CampaignForm({
  platform,
  botId,
  posts,
  destinations,
  hasTopics,
  defaultPostId,
  initial,
}: {
  platform: PlatformSlug;
  botId: string;
  posts: CampaignFormPost[];
  destinations: CampaignFormDestination[];
  hasTopics: boolean;
  defaultPostId?: string;
  initial?: CampaignFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ message: string; campaignId: string } | null>(null);

  const [postId, setPostId] = useState(initial?.postId ?? defaultPostId ?? posts[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(
    initial?.destinationIds ??
      (destinations.filter((d) => d.status === "ACTIVE").length === 1
        ? destinations.filter((d) => d.status === "ACTIVE").map((d) => d.id)
        : []),
  );
  const [mode, setMode] = useState<Mode>(initial?.scheduleKind ?? "DAILY");
  const [times, setTimes] = useState<string[]>(initial?.times.length ? initial.times : ["09:00"]);
  const [newTime, setNewTime] = useState("18:00");
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? [6]);
  const initialInterval = initial?.intervalMinutes ?? 360;
  const [intervalUnit, setIntervalUnit] = useState(initialInterval % 1440 === 0 ? "days" : "hours");
  const [intervalValue, setIntervalValue] = useState(
    String(initialInterval % 1440 === 0 ? initialInterval / 1440 : initialInterval / 60),
  );
  const [startsAt, setStartsAt] = useState(initial?.startsAtLocal ?? "");

  const usable = destinations.filter((destination) => destination.status === "ACTIVE");
  const intervalMinutes = Math.round(Number(intervalValue) * (intervalUnit === "days" ? 1440 : 60));

  const summary = useMemo(() => {
    const count = `${faNumber(selected.length)} مقصد`;
    const at = localToDate(startsAt);
    switch (mode) {
      case "NOW":
        return `پست همین حالا به ${count} ارسال می‌شود.`;
      case "ONCE":
        return at
          ? `پست یک‌بار در ${formatDateTime(at, DEFAULT_TIME_ZONE)} به ${count} ارسال می‌شود.`
          : `زمان ارسال را انتخاب کنید.`;
      case "DAILY":
        return `پست هر روز ساعت ${joinFa(times.map(faTime))} به ${count} ارسال می‌شود.`;
      case "WEEKLY": {
        const days = PERSIAN_WEEK_ORDER.filter((day) => weekdays.includes(day)).map(
          (day) => `${WEEKDAY_LABELS[day]}‌ها`,
        );
        return days.length
          ? `پست ${joinFa(days)} ساعت ${joinFa(times.map(faTime))} به ${count} ارسال می‌شود.`
          : "حداقل یک روز هفته را انتخاب کنید.";
      }
      case "INTERVAL":
        return intervalMinutes >= 60
          ? `پست ${describeInterval(intervalMinutes)} به ${count} ارسال می‌شود${at ? `، از ${formatDateTime(at, DEFAULT_TIME_ZONE)}` : "، از همین حالا"}.`
          : "فاصله تکرار باید حداقل ۱ ساعت باشد.";
    }
  }, [mode, selected.length, times, weekdays, intervalMinutes, startsAt]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || times.includes(newTime)) return;
    setTimes((current) => [...current, newTime].sort());
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!postId) return setError("یک پست انتخاب کنید.");
    if (!selected.length) return setError("حداقل یک مقصد را انتخاب کنید.");
    if ((mode === "DAILY" || mode === "WEEKLY") && !times.length) {
      return setError("حداقل یک ساعت ارسال اضافه کنید.");
    }
    if (mode === "ONCE" && !localToDate(startsAt)) return setError("زمان ارسال را انتخاب کنید.");

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        if (mode === "NOW") {
          const response = await publishNowAction(platform, botId, formData);
          if (response.error || !response.campaignId) {
            setError(response.error ?? "ارسال انجام نشد.");
            return;
          }
          setResult({ message: response.message ?? "", campaignId: response.campaignId });
          return;
        }
        const response = await saveCampaignAction(
          platform,
          botId,
          initial?.campaignId ?? null,
          formData,
        );
        if (response.error || !response.campaignId) {
          setError(response.error ?? "ذخیره کمپین انجام نشد.");
          return;
        }
        router.push(dashboardPath(platform, `campaigns/${response.campaignId}`));
        router.refresh();
      } catch {
        setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
      }
    });
  };

  if (result) {
    return (
      <div className="dashboard-card space-y-4 rounded-2xl p-6 text-center">
        <p className="text-lg font-black text-slate-900">ارسال انجام شد</p>
        <p className="text-sm text-slate-600">{result.message}</p>
        <Button asChild>
          <Link href={dashboardPath(platform, `campaigns/${result.campaignId}`)}>
            مشاهده نتیجه ارسال
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <input type="hidden" name="scheduleKind" value={mode === "NOW" ? "ONCE" : mode} />

      <Step number={1} title="کدام پست؟">
        {posts.length ? (
          <div className="grid gap-2">
            {posts.map((post) => (
              <label
                key={post.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 text-sm transition",
                  postId === post.id ? "border-primary ring-2 ring-primary/20" : "hover:bg-slate-50",
                )}
              >
                <input
                  type="radio"
                  name="postId"
                  value={post.id}
                  checked={postId === post.id}
                  onChange={() => setPostId(post.id)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 leading-6 text-slate-800">{post.label}</span>
                  <span className="text-xs text-slate-400">{post.kind}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            هنوز پستی ندارید.{" "}
            <Link className="font-bold text-primary" href={`${dashboardPath(platform, "posts/new")}?botId=${botId}`}>
              یک پست بسازید
            </Link>{" "}
            یا محتوا را مستقیم برای ربات بفرستید.
          </p>
        )}
      </Step>

      <Step
        number={2}
        title="کجا ارسال شود؟"
        action={
          usable.length > 1 ? (
            <button
              type="button"
              className="text-xs font-bold text-primary"
              onClick={() =>
                setSelected(selected.length === usable.length ? [] : usable.map((d) => d.id))
              }
            >
              {selected.length === usable.length ? "لغو انتخاب همه" : "انتخاب همه"}
            </button>
          ) : null
        }
      >
        {destinations.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {destinations.map((destination) => {
              const disabled = destination.status !== "ACTIVE";
              return (
                <label
                  key={destination.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-white p-3 text-sm",
                    disabled ? "opacity-60" : "cursor-pointer hover:bg-slate-50",
                    selected.includes(destination.id) && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <input
                    type="checkbox"
                    name="destinationIds"
                    value={destination.id}
                    checked={selected.includes(destination.id)}
                    disabled={disabled && !selected.includes(destination.id)}
                    onChange={() => toggle(destination.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-800">{destination.title}</span>
                    <span className="text-xs text-slate-400">
                      {destination.typeLabel}
                      {disabled && " · بدون دسترسی ارسال"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500">
            هنوز مقصدی ندارید. ربات را به کانال یا گروه خود اضافه کنید (در کانال باید مدیر با اجازه ارسال پیام باشد).{" "}
            <Link className="font-bold text-primary" href={dashboardPath(platform, `bots/${botId}`)}>
              راهنمای اتصال
            </Link>
          </p>
        )}
      </Step>

      <Step number={3} title="چه زمانی؟">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {MODES.filter((item) => !initial || item.value !== "NOW").map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={cn(
                "rounded-xl border bg-white px-3 py-2.5 text-right transition",
                mode === item.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-slate-50",
              )}
            >
              <span className="block text-sm font-bold text-slate-900">{item.label}</span>
              <span className="text-xs text-slate-500">{item.hint}</span>
            </button>
          ))}
        </div>

        {mode === "ONCE" && (
          <label className="block space-y-2 text-sm">
            <span className="font-bold text-slate-700">تاریخ و ساعت ارسال (به وقت تهران)</span>
            <Input
              type="datetime-local"
              name="startsAt"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              dir="ltr"
              required
            />
          </label>
        )}

        {mode === "WEEKLY" && (
          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-700">روزهای هفته</span>
            <div className="flex flex-wrap gap-2">
              {PERSIAN_WEEK_ORDER.map((day) => (
                <label
                  key={day}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm",
                    weekdays.includes(day) ? "border-primary bg-primary text-white" : "bg-white",
                  )}
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    checked={weekdays.includes(day)}
                    onChange={() =>
                      setWeekdays((current) =>
                        current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
                      )
                    }
                    className="sr-only"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              ))}
            </div>
          </div>
        )}

        {(mode === "DAILY" || mode === "WEEKLY") && (
          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-700">ساعت‌های ارسال (به وقت تهران)</span>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((time) => (
                <span key={time} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-sm font-bold">
                  {faTime(time)}
                  <input type="hidden" name="times" value={time} />
                  <button
                    type="button"
                    onClick={() => setTimes((current) => current.filter((item) => item !== time))}
                    className="rounded-full p-1 text-slate-500 hover:bg-slate-200"
                    aria-label={`حذف ${time}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <Input
                  type="time"
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                  className="h-8 w-28"
                  dir="ltr"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTime}>
                  <Plus />
                  افزودن
                </Button>
              </span>
            </div>
          </div>
        )}

        {mode === "INTERVAL" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-bold text-slate-700">هر چند وقت یک‌بار؟</span>
              <span className="flex gap-2">
                <Input
                  type="number"
                  name="intervalValue"
                  min={1}
                  step={1}
                  value={intervalValue}
                  onChange={(event) => setIntervalValue(event.target.value)}
                  className="w-24"
                  dir="ltr"
                />
                <select
                  name="intervalUnit"
                  value={intervalUnit}
                  onChange={(event) => setIntervalUnit(event.target.value)}
                  className="h-9 rounded-lg border bg-white px-3 text-sm"
                >
                  <option value="hours">ساعت</option>
                  <option value="days">روز</option>
                </select>
              </span>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-bold text-slate-700">شروع از (خالی = همین حالا)</span>
              <Input
                type="datetime-local"
                name="startsAt"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                dir="ltr"
              />
            </label>
          </div>
        )}
      </Step>

      {mode !== "NOW" && (
        <details className="dashboard-card rounded-2xl p-5" open={Boolean(initial?.name || initial?.endsAtLocal || initial?.maxRuns || initial?.jitterMinutes)}>
          <summary className="cursor-pointer text-sm font-black text-slate-900">
            تنظیمات بیشتر (اختیاری)
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-bold text-slate-700">نام کمپین</span>
              <Input name="name" defaultValue={initial?.name} maxLength={80} placeholder="مثلاً: معرفی محصول هفته" />
            </label>
            {mode !== "ONCE" && (
              <>
                <label className="space-y-2 text-sm">
                  <span className="font-bold text-slate-700">تأخیر تصادفی</span>
                  <select
                    name="jitterMinutes"
                    defaultValue={initial?.jitterMinutes ?? 0}
                    className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  >
                    {JITTER_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes ? `تا ${faNumber(minutes)} دقیقه` : "بدون تأخیر"}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-slate-500">ارسال‌ها کمی جابه‌جا می‌شوند تا طبیعی‌تر به نظر برسند.</span>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-bold text-slate-700">پایان کمپین (اختیاری)</span>
                  <Input type="datetime-local" name="endsAt" defaultValue={initial?.endsAtLocal} dir="ltr" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-bold text-slate-700">حداکثر تعداد اجرا (اختیاری)</span>
                  <Input type="number" name="maxRuns" min={1} defaultValue={initial?.maxRuns ?? ""} dir="ltr" />
                </label>
              </>
            )}
            {hasTopics && (
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="notifySubscribers" defaultChecked={initial?.notifySubscribers} className="mt-1" />
                <span>
                  <span className="font-bold text-slate-700">ارسال خصوصی به مشترک‌های موضوع‌های این پست</span>
                  <span className="block text-xs text-slate-500">فقط کاربرانی که خودشان این موضوع‌ها را در ربات انتخاب کرده‌اند پیام می‌گیرند.</span>
                </span>
              </label>
            )}
          </div>
        </details>
      )}

      <div className="dashboard-card sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold leading-6 text-slate-700">{summary}</p>
        <Button type="submit" disabled={pending || !posts.length || !usable.length} className="shrink-0">
          {pending ? <Loader2 className="animate-spin" /> : mode === "NOW" ? <Rocket /> : <CalendarCheck />}
          {pending ? "در حال انجام…" : mode === "NOW" ? "ارسال کن" : initial ? "ذخیره تغییرات" : "ثبت کمپین"}
        </Button>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}

function Step({
  number,
  title,
  action,
  children,
}: {
  number: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-card space-y-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
          <span className="dashboard-accent-surface flex size-7 items-center justify-center rounded-full text-sm">
            {faNumber(number)}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
