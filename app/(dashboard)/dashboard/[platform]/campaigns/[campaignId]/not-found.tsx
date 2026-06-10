import { Button } from "@/components/ui/button";
import { CalendarX2 } from "lucide-react";
import Link from "next/link";

export default function CampaignNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-sky-100 bg-white p-10 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
        <CalendarX2 className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-black text-slate-950">
        کمپین پیدا نشد
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        این کمپین وجود ندارد، حذف شده یا متعلق به حساب شما نیست.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard/campaigns">بازگشت به کمپین‌ها</Link>
      </Button>
    </div>
  );
}
