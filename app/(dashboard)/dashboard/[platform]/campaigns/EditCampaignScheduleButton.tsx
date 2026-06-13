"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import type { PlatformSlug } from "@/services/bot-platforms/config";
import {
  CalendarDays,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Repeat2,
  X,
} from "lucide-react";
import { FormEvent, useState, useTransition } from "react";
import { updateCampaignScheduleAction } from "./actions";

type ScheduleType = "INTERVAL" | "SPECIFIC_TIMES";
const hours = Array.from({ length: 24 }, (_, index) =>
  index.toString().padStart(2, "0"),
);
const minutes = Array.from({ length: 60 }, (_, index) =>
  index.toString().padStart(2, "0"),
);

export function EditCampaignScheduleButton({
  platform,
  campaignId,
  scheduleType: initialScheduleType,
  intervalHours,
  specificTimes,
}: {
  platform: PlatformSlug;
  campaignId: string;
  scheduleType: ScheduleType;
  intervalHours: number | null;
  specificTimes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [scheduleType, setScheduleType] =
    useState<ScheduleType>(initialScheduleType);
  const [selectedTimes, setSelectedTimes] = useState(
    [...specificTimes].sort(),
  );
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState("18");
  const [selectedMinute, setSelectedMinute] = useState("20");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const openModal = () => {
    const [initialHour = "18", initialMinute = "20"] = (
      specificTimes[0] ?? "18:20"
    ).split(":");
    setScheduleType(initialScheduleType);
    setSelectedTimes([...specificTimes].sort());
    setSelectedHour(initialHour);
    setSelectedMinute(initialMinute);
    setTimePickerOpen(false);
    setError("");
    setOpen(true);
  };

  const close = () => {
    if (pending) return;
    setError("");
    setOpen(false);
  };

  const addTime = () => {
    const timeToAdd = `${selectedHour}:${selectedMinute}`;
    setSelectedTimes((current) =>
      current.includes(timeToAdd)
        ? current
        : [...current, timeToAdd].sort(),
    );
    setTimePickerOpen(false);
  };

  const removeTime = (time: string) => {
    setSelectedTimes((current) => current.filter((item) => item !== time));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (scheduleType === "SPECIFIC_TIMES" && selectedTimes.length === 0) {
      setError("حداقل یک ساعت اجرا انتخاب کنید.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await updateCampaignScheduleAction(
          platform,
          campaignId,
          formData,
        );

        if (result.error) {
          setError(result.error);
          return;
        }

        setOpen(false);
      } catch {
        setError("ویرایش زمان‌بندی انجام نشد. دوباره تلاش کنید.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[color:var(--dashboard-accent-ink)] transition-colors hover:bg-white/70"
        aria-label="ویرایش زمان‌بندی کمپین"
        title="ویرایش زمان‌بندی"
      >
        <Pencil className="size-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`schedule-title-${campaignId}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-2xl shadow-slate-950/20 sm:p-6"
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id={`schedule-title-${campaignId}`}
                  className="text-lg font-bold text-slate-950"
                >
                  ویرایش زمان‌بندی کمپین
                </h2>
                <p className="mt-1 text-xs font-normal leading-6 text-slate-500">
                  اجرای بعدی بر اساس تنظیم جدید دوباره محاسبه می‌شود.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={close}
                disabled={pending}
                aria-label="بستن"
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">
                  نوع زمان‌بندی
                </span>
                <input
                  type="hidden"
                  name="scheduleType"
                  value={scheduleType}
                />
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  <Toggle
                    type="button"
                    pressed={scheduleType === "INTERVAL"}
                    onPressedChange={() => setScheduleType("INTERVAL")}
                    className="h-10 rounded-xl border border-transparent text-slate-500 data-[state=on]:border-[color:var(--dashboard-accent-border)] data-[state=on]:bg-white data-[state=on]:text-[color:var(--dashboard-accent-ink)] data-[state=on]:shadow-sm"
                    aria-label="تکرار دوره‌ای"
                  >
                    <Repeat2 className="size-4" />
                    تکرار دوره‌ای
                  </Toggle>
                  <Toggle
                    type="button"
                    pressed={scheduleType === "SPECIFIC_TIMES"}
                    onPressedChange={() => setScheduleType("SPECIFIC_TIMES")}
                    className="h-10 rounded-xl border border-transparent text-slate-500 data-[state=on]:border-[color:var(--dashboard-accent-border)] data-[state=on]:bg-white data-[state=on]:text-[color:var(--dashboard-accent-ink)] data-[state=on]:shadow-sm"
                    aria-label="ساعت‌های مشخص"
                  >
                    <CalendarDays className="size-4" />
                    ساعت‌های مشخص
                  </Toggle>
                </div>
              </div>

              {scheduleType === "INTERVAL" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    فاصله اجرا بر حسب ساعت
                  </span>
                  <Input
                    name="intervalHours"
                    type="number"
                    min={2}
                    step={1}
                    required
                    defaultValue={intervalHours ?? 24}
                    className="h-10"
                    dir="ltr"
                  />
                  <span className="block text-xs font-normal leading-5 text-slate-400">
                    مثال: برای اجرای هر شش ساعت، عدد 6 را وارد کنید.
                  </span>
                </label>
              ) : (
                <div className="space-y-3">
                  <input
                    type="hidden"
                    name="specificTimes"
                    value={selectedTimes.join(",")}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700">
                      ساعت‌های اجرا
                    </span>
                    <Popover
                      open={timePickerOpen}
                      onOpenChange={setTimePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-[color:var(--dashboard-accent-border)] bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent-ink)]"
                        >
                          <Plus className="size-4" />
                          افزودن ساعت
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="z-[80] w-72 gap-3 rounded-2xl p-3"
                        dir="rtl"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">
                            انتخاب ساعت اجرا
                          </p>
                          <span
                            className="rounded-lg bg-[color:var(--dashboard-accent-soft)] px-2.5 py-1 font-mono text-sm font-medium text-[color:var(--dashboard-accent-ink)]"
                            dir="ltr"
                          >
                            {selectedHour}:{selectedMinute}
                          </span>
                        </div>

                        <div
                          className="grid grid-cols-2 gap-2 overflow-hidden rounded-xl border border-slate-200"
                          dir="ltr"
                        >
                          <TimeColumn
                            label="ساعت"
                            values={hours}
                            selected={selectedHour}
                            onSelect={setSelectedHour}
                          />
                          <TimeColumn
                            label="دقیقه"
                            values={minutes}
                            selected={selectedMinute}
                            onSelect={setSelectedMinute}
                          />
                        </div>

                        <Button
                          type="button"
                          className="w-full"
                          onClick={addTime}
                        >
                          <Clock3 className="size-4" />
                          افزودن {selectedHour}:{selectedMinute}
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedTimes.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {selectedTimes.map((time) => (
                        <div
                          key={time}
                          className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                        >
                          <span
                            className="flex items-center gap-2 text-sm font-normal text-slate-700"
                            dir="ltr"
                          >
                            <Clock3 className="size-4 text-[color:var(--dashboard-accent-ink)]" />
                            {time}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTime(time)}
                            className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
                            aria-label={`حذف ساعت ${time}`}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs font-normal text-slate-400">
                      هنوز ساعتی اضافه نشده است.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={pending}
                >
                  انصراف
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Pencil />
                  )}
                  {pending ? "در حال ذخیره..." : "ذخیره زمان‌بندی"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500">
        {label}
      </p>
      <ScrollArea className="h-48">
        <div className="space-y-1 p-1.5">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={`flex h-8 w-full items-center justify-center rounded-lg font-mono text-sm transition-colors ${
                selected === value
                  ? "bg-[color:var(--dashboard-accent)] text-white"
                  : "text-slate-600 hover:bg-[color:var(--dashboard-accent-soft)] hover:text-[color:var(--dashboard-accent-ink)]"
              }`}
              aria-pressed={selected === value}
            >
              {value}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
