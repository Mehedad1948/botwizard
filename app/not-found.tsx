import { ErrorState } from "@/components/errors/ErrorState";
import { Button } from "@/components/ui/button";
import { House, LayoutDashboard, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <ErrorState
      code="۴۰۴"
      title="صفحه موردنظر پیدا نشد"
      description="ممکن است آدرس اشتباه باشد، صفحه حذف شده باشد یا دسترسی آن تغییر کرده باشد."
      icon={<SearchX />}
      actions={
        <>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <House />
              صفحه اصلی
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard">
              <LayoutDashboard />
              رفتن به داشبورد
            </Link>
          </Button>
        </>
      }
    />
  );
}
