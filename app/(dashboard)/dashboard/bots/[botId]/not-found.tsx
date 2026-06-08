import Link from "next/link";
import { ArrowRight, BotOff, LayoutDashboard } from "lucide-react";

import { ErrorState } from "@/components/errors/ErrorState";
import { Button } from "@/components/ui/button";

export default function BotNotFound() {
  return (
    <ErrorState
      compact
      code="ربات در دسترس نیست"
      title="ربات موردنظر پیدا نشد"
      description="این ربات حذف شده، شناسه آن نادرست است یا به حساب کاربری شما تعلق ندارد."
      icon={<BotOff />}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <LayoutDashboard />
              نمای کلی
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/bots">
              <ArrowRight />
              بازگشت به ربات‌ها
            </Link>
          </Button>
        </>
      }
    />
  );
}
