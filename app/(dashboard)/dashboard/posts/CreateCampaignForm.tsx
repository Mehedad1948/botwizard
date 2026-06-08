"use client";

import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2, Send } from "lucide-react";
import { FormEvent, useRef, useState, useTransition } from "react";
import {
  createCampaignFromDashboardAction,
  sendPostNowAction,
} from "./actions";

type Destination = {
  id: string;
  chatTitle: string;
};

export function CreateCampaignForm({
  postId,
  destinations,
}: {
  postId: string;
  destinations: Destination[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"send" | "schedule" | null>(
    null
  );
  const [scheduleType, setScheduleType] = useState<
    "INTERVAL" | "SPECIFIC_TIMES"
  >("INTERVAL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    setPendingAction("schedule");

    startTransition(async () => {
      try {
        const result = await createCampaignFromDashboardAction(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        setSuccess("کمپین با موفقیت ایجاد شد.");
        formRef.current?.reset();
        setScheduleType("INTERVAL");
      } catch {
        setError("ایجاد کمپین انجام نشد. دوباره تلاش کنید.");
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSendNow = () => {
    if (!formRef.current) return;

    setError("");
    setSuccess("");
    setPendingAction("send");
    const formData = new FormData(formRef.current);

    startTransition(async () => {
      try {
        const result = await sendPostNowAction(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        setSuccess("پست با موفقیت به مقصد ارسال شد.");
      } catch {
        setError("ارسال پیام انجام نشد. دوباره تلاش کنید.");
      } finally {
        setPendingAction(null);
      }
    });
  };

  if (destinations.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
        برای ساخت کمپین، ابتدا ربات را به یک گروه یا کانال اضافه کنید.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl bg-muted/50 p-3"
    >
      <input type="hidden" name="postId" value={postId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          name="connectedChatId"
          required
          defaultValue=""
          className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="" disabled>
            انتخاب گروه یا کانال
          </option>
          {destinations.map((destination) => (
            <option key={destination.id} value={destination.id}>
              {destination.chatTitle}
            </option>
          ))}
        </select>
        <select
          name="scheduleType"
          required
          value={scheduleType}
          onChange={(event) =>
            setScheduleType(
              event.target.value as "INTERVAL" | "SPECIFIC_TIMES"
            )
          }
          className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="INTERVAL">تکرار دوره‌ای</option>
          <option value="SPECIFIC_TIMES">ساعت‌های مشخص</option>
        </select>
      </div>

      {scheduleType === "INTERVAL" ? (
        <select
          name="intervalHours"
          required
          defaultValue="24"
          className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="2">هر ۲ ساعت</option>
          <option value="12">هر ۱۲ ساعت</option>
          <option value="24">هر ۲۴ ساعت</option>
        </select>
      ) : (
        <input
          name="specificTimes"
          required
          placeholder="مثال: 09:00, 18:30"
          dir="ltr"
          className="h-9 w-full rounded-lg border bg-background px-3 text-left text-xs outline-none focus:ring-2 focus:ring-ring/40"
        />
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        ساعت‌های مشخص براساس زمان ایران محاسبه می‌شوند.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={handleSendNow}
        >
          {pendingAction === "send" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send />
          )}
          {pendingAction === "send" ? "در حال ارسال..." : "ارسال فوری"}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pendingAction === "schedule" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CalendarPlus />
          )}
          {pendingAction === "schedule"
            ? "در حال ایجاد..."
            : "ایجاد زمان‌بندی"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </form>
  );
}
