"use client";

import { useEffect } from "react";
import Link from "next/link";
import { House, RefreshCw, TriangleAlert } from "lucide-react";

import { ErrorState } from "@/components/errors/ErrorState";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <ErrorState
      code="خطای برنامه"
      title="نمایش این صفحه با مشکل روبه‌رو شد"
      description="این خطا ممکن است موقتی باشد. دوباره تلاش کنید و اگر مشکل ادامه داشت، کد پیگیری را برای پشتیبانی ارسال کنید."
      icon={<TriangleAlert />}
      reference={error.digest}
      actions={
        <>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <House />
              صفحه اصلی
            </Link>
          </Button>
          <Button type="button" size="lg" onClick={() => unstable_retry()}>
            <RefreshCw />
            تلاش دوباره
          </Button>
        </>
      }
    />
  );
}
