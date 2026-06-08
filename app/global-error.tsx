"use client";

import { useEffect } from "react";
import { RefreshCw, Siren } from "lucide-react";

import { ErrorState } from "@/components/errors/ErrorState";
import { Button } from "@/components/ui/button";
import "./tailwindcss.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Global application error", error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body>
        <title>خطای سیستمی | Bot Wizard</title>
        <ErrorState
          code="خطای سیستمی"
          title="سرویس در حال حاضر در دسترس نیست"
          description="بخش اصلی برنامه با خطای پیش‌بینی‌نشده روبه‌رو شده است. دوباره تلاش کنید؛ در صورت تداوم مشکل، کد پیگیری را برای پشتیبانی ارسال کنید."
          icon={<Siren />}
          reference={error.digest}
          actions={
            <Button type="button" size="lg" onClick={() => unstable_retry()}>
              <RefreshCw />
              بارگذاری دوباره
            </Button>
          }
        />
      </body>
    </html>
  );
}
