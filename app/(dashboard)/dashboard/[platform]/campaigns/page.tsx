import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  Clock3,
  ExternalLink,
  ListTree,
  Pause,
  Play,
  Send,
  MessageCircleMore,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteCampaignAction,
  sendCampaignNowAction,
  sendCampaignPreviewToOwnerAction,
  toggleCampaignAction,
} from "./actions";
import { EditCampaignScheduleButton } from "./EditCampaignScheduleButton";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  const { platform } = await params;
  const { status } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const platformConfig = platformConfigs[platformSlug];

  const campaigns = await prisma.campaign.findMany({
    where: {
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platformSlug),
      },
    },
    include: {
      bot: { select: { id: true, username: true, isActive: true } },
      _count: { select: { history: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.isActive,
  ).length;
  const inactiveCampaigns = campaigns.length - activeCampaigns;
  const statusFilter =
    status === "active" || status === "inactive" ? status : null;
  const filteredCampaigns = statusFilter
    ? campaigns.filter((campaign) =>
      statusFilter === "active" ? campaign.isActive : !campaign.isActive,
    )
    : campaigns;
  const campaignsPath = dashboardPath(platformSlug, "campaigns");
  const now = new Date();

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
          هنوز کمپینی ثبت نشده است. از داخل ربات {platformConfig.labelFa} یک زمان‌بندی ایجاد
          کنید.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
            <Link
              href={
                statusFilter === "active"
                  ? campaignsPath
                  : `${campaignsPath}?status=active`
              }
              aria-current={statusFilter === "active" ? "true" : undefined}
              className={`rounded-xl border px-3 py-2 text-emerald-700 transition-all ${statusFilter === "active"
                ? "border-emerald-400 bg-emerald-100 shadow-sm ring-2 ring-emerald-200"
                : "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100"
                }`}
            >
              {activeCampaigns.toLocaleString("fa-IR")} کمپین فعال
            </Link>
            <Link
              href={
                statusFilter === "inactive"
                  ? campaignsPath
                  : `${campaignsPath}?status=inactive`
              }
              aria-current={statusFilter === "inactive" ? "true" : undefined}
              className={`rounded-xl border px-3 py-2 text-slate-600 transition-all ${statusFilter === "inactive"
                ? "border-slate-400 bg-slate-200 shadow-sm ring-2 ring-slate-200"
                : "border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200"
                }`}
            >
              {inactiveCampaigns.toLocaleString("fa-IR")} کمپین متوقف
            </Link>
            {statusFilter && (
              <Link
                href={campaignsPath}
                className="px-2 py-2 text-xs font-bold text-slate-500 transition hover:text-slate-900"
              >
                نمایش همه
              </Link>
            )}
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
              کمپینی با این وضعیت وجود ندارد.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredCampaigns.map((campaign) => {
                const timeRemaining = formatTimeRemaining(campaign.nextRun, now);

                return (
                  <article
                    key={campaign.id}
                    className="dashboard-card space-y-4 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${campaign.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              }`}
                          >
                            {campaign.isActive ? "فعال" : "متوقف"}
                          </span>
                        </div>
                        <h2 className="font-semibold">{campaign.chatTitle}</h2>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          @{campaign.bot.username}
                        </p>
                      </div>
                      <div className="flex max-w-[58%] items-center gap-1 rounded-2xl border border-[color:var(--dashboard-accent-border)] bg-[color:var(--dashboard-accent-soft)] px-2 py-1.5 text-left text-sm font-black leading-6 text-[color:var(--dashboard-accent-ink)] shadow-sm shadow-[color:var(--dashboard-accent-shadow)]">
                        <span>
                          {campaign.scheduleType === "SPECIFIC_TIMES"
                            ? `روزانه: ${campaign.specificTimes.join("، ")}`
                            : `هر ${campaign.intervalHours} ساعت`}
                        </span>
                        <EditCampaignScheduleButton
                          platform={platformSlug}
                          campaignId={campaign.id}
                          scheduleType={campaign.scheduleType}
                          intervalHours={campaign.intervalHours}
                          specificTimes={campaign.specificTimes}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      {campaign.isActive && <>
                        <span className="flex items-center gap-2">
                          <Clock3 className="size-4" />
                          اجرای بعدی: {tehranDateTime.format(campaign.nextRun)}
                        </span>
                        <span className={timeRemaining.className}>
                          {timeRemaining.label}
                        </span>
                      </>}
                      <span>
                        {campaign._count.history === 0
                          ? "بدون اجرا تا این لحظه"
                          : `${campaign._count.history.toLocaleString("fa-IR")} اجرای ثبت‌شده`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button asChild size="sm" className="shadow-sm">
                        <Link
                          href={dashboardPath(
                            platformSlug,
                            `campaigns/${campaign.id}`,
                          )}
                        >
                          <ListTree />
                          جزئیات کمپین
                        </Link>
                      </Button>
                      <ConfirmedActionButton
                        action={sendCampaignNowAction.bind(
                          null,
                          platformSlug,
                          campaign.id,
                        )}
                        confirmTitle="ارسال دستی پیام به مقصد؟"
                        confirmDescription={`پیام همین حالا به «${campaign.chatTitle}» ارسال می‌شود و در تاریخچه کمپین ثبت خواهد شد.`}
                        pendingLabel="در حال ارسال..."
                        variant="bale"
                        className="shadow-sm"
                      >
                        <Send />
                        ارسال دستی به مقصد
                      </ConfirmedActionButton>
                      <ConfirmedActionButton
                        action={sendCampaignPreviewToOwnerAction.bind(
                          null,
                          platformSlug,
                          campaign.id,
                        )}
                        confirmTitle={`ارسال پیش‌نمایش در ${platformConfig.labelFa}؟`}
                        confirmDescription="پیام دوباره در گفت‌وگوی خصوصی شما با همین ربات ارسال می‌شود تا آن را کامل ببینید."
                        pendingLabel="در حال ارسال..."
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                      >
                        <MessageCircleMore />
                        مشاهده پیام در {platformConfig.labelFa}
                      </ConfirmedActionButton>
                      <Button asChild variant="outline" size="sm" className="shadow-sm">
                        <Link
                          href={`${dashboardPath(
                            platformSlug,
                            `bots/${campaign.bot.id}`,
                          )}#campaigns`}
                        >
                          <ExternalLink />
                          جزئیات ربات
                        </Link>
                      </Button>
                      <ConfirmedActionButton
                        action={toggleCampaignAction.bind(
                          null,
                          platformSlug,
                          campaign.id,
                        )}
                        pendingLabel="در حال تغییر..."
                        variant="secondary"
                        className="shadow-sm"
                      >
                        {campaign.isActive ? <Pause /> : <Play />}
                        {campaign.isActive ? "توقف" : "فعال‌سازی"}
                      </ConfirmedActionButton>
                      <ConfirmedActionButton
                        action={deleteCampaignAction.bind(
                          null,
                          platformSlug,
                          campaign.id,
                        )}
                        confirmTitle="حذف دائمی کمپین؟"
                        confirmDescription="این کمپین و تاریخچه ارسال آن برای همیشه حذف می‌شود."
                        pendingLabel="در حال حذف..."
                        variant="destructive"
                        className="shadow-sm"
                      >
                        <Trash2 />
                        حذف
                      </ConfirmedActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimeRemaining(nextRun: Date, now: Date) {
  const remainingMinutes = Math.floor(
    (nextRun.getTime() - now.getTime()) / (60 * 1000),
  );

  if (remainingMinutes <= 0) {
    return {
      label: "زمان اجرای بعدی رسیده است",
      className: "font-bold text-amber-600",
    };
  }

  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days.toLocaleString("fa-IR")} روز`);
  if (hours > 0) parts.push(`${hours.toLocaleString("fa-IR")} ساعت`);
  if (minutes > 0 && days === 0) {
    parts.push(`${minutes.toLocaleString("fa-IR")} دقیقه`);
  }

  return {
    label: `تا اجرای بعدی: ${parts.join(" و ") || "کمتر از یک دقیقه"}`,
    className: "font-bold text-emerald-600",
  };
}
