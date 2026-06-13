import {
  deleteCampaignAction,
  sendCampaignNowAction,
  sendCampaignPreviewToOwnerAction,
  toggleCampaignAction,
} from "@/app/(dashboard)/dashboard/[platform]/campaigns/actions";
import { EditCampaignScheduleButton } from "@/app/(dashboard)/dashboard/[platform]/campaigns/EditCampaignScheduleButton";
import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import {
  dashboardPath,
  platformConfigs,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import {
  Clock3,
  ExternalLink,
  ListTree,
  MessageCircleMore,
  Pause,
  Play,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export type CampaignCardData = {
  id: string;
  chatTitle: string;
  isActive: boolean;
  scheduleType: "INTERVAL" | "SPECIFIC_TIMES";
  intervalHours: number | null;
  specificTimes: string[];
  nextRun: Date;
  bot: {
    id: string;
    username: string;
  };
  _count: {
    history: number;
  };
};

export function CampaignCard({
  campaign,
  platform,
  showBotDetails = true,
}: {
  campaign: CampaignCardData;
  platform: PlatformSlug;
  showBotDetails?: boolean;
}) {
  const platformConfig = platformConfigs[platform];
  const timeRemaining = formatTimeRemaining(campaign.nextRun, new Date());

  return (
    <article className="dashboard-card space-y-4 rounded-2xl p-5">
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
          </div>
          <h3 className="font-semibold">{campaign.chatTitle}</h3>
          {showBotDetails && (
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              @{campaign.bot.username}
            </p>
          )}
        </div>

        <div className="flex max-w-[58%] items-center gap-1 rounded-2xl border border-[color:var(--dashboard-accent-border)] bg-[color:var(--dashboard-accent-soft)] px-2 py-1.5 text-left text-sm font-black leading-6 text-[color:var(--dashboard-accent-ink)] shadow-sm shadow-[color:var(--dashboard-accent-shadow)]">
          <span>
            {campaign.scheduleType === "SPECIFIC_TIMES"
              ? `روزانه: ${campaign.specificTimes.join("، ")}`
              : `هر ${campaign.intervalHours} ساعت`}
          </span>
          <EditCampaignScheduleButton
            platform={platform}
            campaignId={campaign.id}
            scheduleType={campaign.scheduleType}
            intervalHours={campaign.intervalHours}
            specificTimes={campaign.specificTimes}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {campaign.isActive && (
          <>
            <span className="flex items-center gap-2">
              <Clock3 className="size-4" />
              اجرای بعدی: {tehranDateTime.format(campaign.nextRun)}
            </span>
            <span className={timeRemaining.className}>
              {timeRemaining.label}
            </span>
          </>
        )}
        <span>
          {campaign._count.history === 0
            ? "بدون اجرا تا این لحظه"
            : `${campaign._count.history.toLocaleString("fa-IR")} اجرای ثبت‌شده`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild size="sm" className="shadow-sm">
          <Link href={dashboardPath(platform, `campaigns/${campaign.id}`)}>
            <ListTree />
            جزئیات کمپین
          </Link>
        </Button>

        <ConfirmedActionButton
          action={sendCampaignNowAction.bind(null, platform, campaign.id)}
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
            platform,
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

        {showBotDetails && (
          <Button asChild variant="outline" size="sm" className="shadow-sm">
            <Link
              href={`${dashboardPath(
                platform,
                `bots/${campaign.bot.id}`,
              )}#campaigns`}
            >
              <ExternalLink />
              جزئیات ربات
            </Link>
          </Button>
        )}

        <ConfirmedActionButton
          action={toggleCampaignAction.bind(null, platform, campaign.id)}
          pendingLabel="در حال تغییر..."
          variant="secondary"
          className="shadow-sm"
        >
          {campaign.isActive ? <Pause /> : <Play />}
          {campaign.isActive ? "توقف" : "فعال‌سازی"}
        </ConfirmedActionButton>

        <ConfirmedActionButton
          action={deleteCampaignAction.bind(null, platform, campaign.id)}
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
