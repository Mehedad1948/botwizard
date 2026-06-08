import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  CalendarClock,
  Clock3,
  ExternalLink,
  FileText,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteCampaignAction, toggleCampaignAction } from "./actions";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    where: { bot: { userId: session.userId } },
    include: {
      bot: { select: { id: true, username: true, isActive: true } },
      post: { select: { content: true, mediaType: true } },
      _count: { select: { history: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">مدیریت کمپین‌ها</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          همه ارسال‌های زمان‌بندی‌شده ربات‌های خود را در یک نمای یکپارچه مدیریت کنید.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          هنوز کمپینی ثبت نشده است. از داخل ربات تلگرام یا صفحه پست‌ها یک
          زمان‌بندی ایجاد کنید.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        campaign.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {campaign.isActive ? "فعال" : "متوقف"}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {campaign.scheduleType === "SPECIFIC_TIMES"
                        ? `روزانه: ${campaign.specificTimes.join("، ")}`
                        : `هر ${campaign.intervalHours} ساعت`}
                    </span>
                  </div>
                  <h2 className="font-semibold">{campaign.chatTitle}</h2>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    @{campaign.bot.username}
                  </p>
                </div>
                <CalendarClock className="size-5 text-muted-foreground" />
              </div>

              <div className="rounded-xl bg-muted/60 p-3">
                <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="size-4" />
                  محتوای مرتبط
                </p>
                <p className="line-clamp-3 text-sm leading-6">
                  {campaign.post.content || "محتوای رسانه‌ای بدون متن"}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Clock3 className="size-4" />
                  اجرای بعدی: {tehranDateTime.format(campaign.nextRun)}
                </span>
                <span>
                  {campaign._count.history.toLocaleString("fa-IR")} اجرای
                  ثبت‌شده
                </span>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/bots/${campaign.bot.id}#campaigns`}>
                    <ExternalLink />
                    جزئیات ربات
                  </Link>
                </Button>
                <ConfirmedActionButton
                  action={toggleCampaignAction.bind(null, campaign.id)}
                  pendingLabel="در حال تغییر..."
                >
                  {campaign.isActive ? <Pause /> : <Play />}
                  {campaign.isActive ? "توقف" : "فعال‌سازی"}
                </ConfirmedActionButton>
                <ConfirmedActionButton
                  action={deleteCampaignAction.bind(null, campaign.id)}
                  confirmTitle="حذف دائمی کمپین؟"
                  confirmDescription="این کمپین و تاریخچه ارسال آن برای همیشه حذف می‌شود."
                  pendingLabel="در حال حذف..."
                  variant="destructive"
                >
                  <Trash2 />
                  حذف
                </ConfirmedActionButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
