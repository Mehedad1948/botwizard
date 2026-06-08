"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bot, LayoutDashboard, RefreshCw, TriangleAlert } from "lucide-react";

import { ErrorState } from "@/components/errors/ErrorState";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <ErrorState
      compact
      code="خطای داشبورد"
      title="اطلاعات داشبورد بارگذاری نشد"
      description="ارتباط با سرویس یا پایگاه داده کامل نشده است. دوباره تلاش کنید؛ عملیات قبلی را تا مشاهده نتیجه تکرار نکنید."
      icon={<TriangleAlert />}
      reference={error.digest}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <LayoutDashboard />
              نمای کلی
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/bots">
              <Bot />
              مدیریت ربات‌ها
            </Link>
          </Button>
          <Button type="button" onClick={() => unstable_retry()}>
            <RefreshCw />
            تلاش دوباره
          </Button>
        </>
      }
    />
  );
}
