"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Loader2 } from "lucide-react";
import { FormEvent, useRef, useState, useTransition } from "react";
import { addBotAction } from "./actions";
import Link from "next/link";
import {
  dashboardPath,
  type PlatformSlug,
} from "@/services/bot-platforms/config";

export function AddBotForm({ platform }: { platform: PlatformSlug }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [botId, setBotId] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addBotAction(platform, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      formRef.current?.reset();
      setBotId(result.botId ?? "");
      setSuccess(
        result.pairingCommand
          ? `ربات ثبت شد. برای اتصال مالک، این دستور را در گفت‌وگوی خصوصی ربات بفرستید: ${result.pairingCommand}`
          : "ربات ثبت و متصل شد. حالا آن را به کانال یا گروه خود اضافه کنید.",
      );
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-2"
    >
      <label htmlFor="token" className="block text-sm font-medium">
        توکن ربات
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="password"
          id="token"
          name="token"
          autoComplete="off"
          placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
          dir="ltr"
          required
          className="h-10 flex-1"
        />
        <Button
          type="submit"
          variant="brand-dark"
          size="brand-sm"
          disabled={pending}
          className="w-full shrink-0 whitespace-nowrap sm:w-auto"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Bot />}
          {pending ? "در حال بررسی و اتصال..." : "افزودن ربات"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        توکن محرمانه است و پس از ثبت در صفحه نمایش داده نمی‌شود.
      </p>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
      {success && (
        <p className="w-full rounded-xl bg-emerald-50 p-3 text-xs leading-6 text-emerald-700">
          {success}
          {botId && (
            <Link
              href={dashboardPath(platform, `bots/${botId}`)}
              className="mr-2 font-bold underline"
            >
              ادامه راه‌اندازی ربات
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
