"use client";

import { CalendarPlus, ImagePlus, Loader2, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import {
  createPostAction,
  updatePostAction,
} from "@/app/(dashboard)/dashboard/[platform]/posts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  dashboardPath,
  type PlatformSlug,
} from "@/services/bot-platforms/config";

const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;
const MAX_FILE_MB = 20;

type BotOption = { id: string; username: string; canUpload: boolean };

export function PostComposer({
  platform,
  bots,
  defaultBotId,
  post,
}: {
  platform: PlatformSlug;
  bots: BotOption[];
  defaultBotId?: string;
  post?: {
    id: string;
    botId: string;
    title: string;
    content: string;
    buttons: string;
    hasMedia: boolean;
    hasFormatting: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [botId, setBotId] = useState(post?.botId ?? defaultBotId ?? bots[0]?.id ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ postId: string; botId: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const hasMedia = Boolean(file) || Boolean(post?.hasMedia);
  const limit = hasMedia ? MAX_CAPTION : MAX_TEXT;
  const selectedBot = bots.find((bot) => bot.id === botId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    formData.delete("file");
    if (file) formData.set("file", file);
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`حجم فایل بیش از ${MAX_FILE_MB.toLocaleString("fa-IR")} مگابایت است. فایل‌های بزرگ را مستقیم برای ربات بفرستید.`);
      return;
    }

    startTransition(async () => {
      try {
        if (post) {
          const result = await updatePostAction(platform, post.botId, post.id, formData);
          if (result.error) setError(result.error);
          else {
            setSaved(true);
            router.refresh();
          }
          return;
        }
        const result = await createPostAction(platform, formData);
        if (result.error || !result.postId || !result.botId) {
          setError(result.error ?? "ذخیره پست انجام نشد.");
          return;
        }
        setCreated({ postId: result.postId, botId: result.botId });
      } catch {
        setError("ارسال فرم انجام نشد. اگر فایل بزرگی انتخاب کرده‌اید، آن را مستقیم برای ربات بفرستید.");
      }
    });
  };

  if (created) {
    return (
      <div className="dashboard-card space-y-4 rounded-2xl p-6 text-center">
        <p className="text-lg font-black text-slate-900">پست ذخیره شد ✅</p>
        <p className="text-sm text-slate-500">
          حالا آن را فوری ارسال کنید یا برایش زمان‌بندی بسازید.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link
              href={`${dashboardPath(platform, "campaigns/new")}?botId=${created.botId}&postId=${created.postId}`}
            >
              <CalendarPlus />
              ارسال یا زمان‌بندی این پست
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreated(null);
              setContent("");
              setFile(null);
            }}
          >
            ساخت پست دیگر
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="dashboard-card space-y-5 rounded-2xl p-5 sm:p-6">
      {!post && bots.length > 1 && (
        <Field label="ربات">
          <select
            name="botId"
            value={botId}
            onChange={(event) => setBotId(event.target.value)}
            className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
            dir="ltr"
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                @{bot.username}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!post && bots.length === 1 && <input type="hidden" name="botId" value={botId} />}

      <Field label="عنوان داخلی (اختیاری)" hint="فقط برای پیدا کردن پست در داشبورد؛ ارسال نمی‌شود.">
        <Input name="title" defaultValue={post?.title} maxLength={120} placeholder="مثلاً: تخفیف آخر هفته" />
      </Field>

      {!post && (
        <Field
          label="عکس، ویدیو یا فایل (اختیاری)"
          hint={
            selectedBot?.canUpload
              ? `حداکثر ${MAX_FILE_MB.toLocaleString("fa-IR")} مگابایت. فایل یک‌بار برای شما در ربات ارسال می‌شود تا آماده انتشار شود.`
              : "برای بارگذاری فایل، ابتدا حساب خود را به ربات متصل کنید (از صفحه ربات). می‌توانید فایل را مستقیم برای ربات هم بفرستید."
          }
        >
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <span className="truncate" dir="ltr">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="حذف فایل">
                <X />
              </Button>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-slate-500 transition hover:bg-slate-50 ${selectedBot?.canUpload ? "" : "pointer-events-none opacity-50"}`}
            >
              <ImagePlus className="size-4" />
              انتخاب فایل
              <input
                type="file"
                className="sr-only"
                accept="image/*,video/*,audio/*,application/pdf,application/zip,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </Field>
      )}

      <Field
        label={hasMedia ? "توضیح زیر فایل" : "متن پست"}
        hint={
          post?.hasFormatting
            ? "این پست قالب‌بندی (بولد، لینک و…) دارد؛ با تغییر متن، قالب‌بندی حذف می‌شود."
            : "برای قالب‌بندی پیشرفته (بولد، لینک، اسپویلر)، پست را مستقیم برای ربات بفرستید."
        }
      >
        <textarea
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          maxLength={limit}
          required={!hasMedia}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm leading-7 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="متن پست را بنویسید…"
        />
        <p className={`text-left text-xs ${content.length > limit * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
          {content.length.toLocaleString("fa-IR")} / {limit.toLocaleString("fa-IR")}
        </p>
      </Field>

      <Field
        label="دکمه‌های لینک (اختیاری)"
        hint="هر دکمه در یک خط: متن دکمه | آدرس"
      >
        <textarea
          name="buttons"
          defaultValue={post?.buttons}
          rows={3}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm leading-7 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="خرید از سایت | https://example.com"
        />
      </Field>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">تغییرات ذخیره شد.</p>}

      <Button type="submit" disabled={pending || !botId} className="w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {pending ? (file ? "در حال بارگذاری…" : "در حال ذخیره…") : post ? "ذخیره تغییرات" : "ذخیره پست"}
      </Button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-bold text-slate-800">{label}</span>
      {children}
      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}
