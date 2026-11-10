import type { CampaignStatus, DeliveryStatus, MediaType, ScheduleKind } from "@prisma/client";
import { CalendarClock, Megaphone, Pause, Play, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";

import {
  deleteCampaignAction,
  runCampaignNowAction,
  setCampaignPausedAction,
} from "@/app/(dashboard)/dashboard/[platform]/campaigns/actions";
import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { CampaignStatusBadge, DeliveryStatusBadge } from "@/components/publishing/ui";
import {
  dashboardPath,
  type PlatformSlug,
} from "@/services/bot-platforms/config";
import { postPreviewText } from "@/services/publishing/content";
import { describeSchedule, faNumber, formatDateTime } from "@/services/publishing/format";

export type CampaignCardData = {
  id: string;
  name: string | null;
  status: CampaignStatus;
  scheduleKind: ScheduleKind;
  intervalMinutes: number | null;
  times: string[];
  weekdays: number[];
  startsAt: Date;
  timezone: string;
  nextRun: Date | null;
  lastRunAt: Date | null;
  post: { title: string | null; content: string | null; mediaType: MediaType };
  bot?: { username: string };
  _count: { targets: number };
  deliveries: { status: DeliveryStatus; createdAt: Date }[];
};

export const campaignCardInclude = {
  post: { select: { title: true, content: true, mediaType: true } },
  bot: { select: { username: true } },
  _count: { select: { targets: true } },
  deliveries: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { status: true, createdAt: true },
  },
};

export function CampaignCard({
  campaign,
  platform,
  showBot = true,
}: {
  campaign: CampaignCardData;
  platform: PlatformSlug;
  showBot?: boolean;
}) {
  const title = campaign.name || campaign.post.title || postPreviewText(campaign.post, 70);
  const lastDelivery = campaign.deliveries[0];

  return (
    <article className="dashboard-card flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={dashboardPath(platform, `campaigns/${campaign.id}`)}
          className="min-w-0 flex-1 space-y-1"
        >
          <h3 className="line-clamp-2 font-bold leading-7 text-slate-900 hover:underline">{title}</h3>
          {showBot && campaign.bot && (
            <p className="text-xs text-slate-400" dir="ltr">
              @{campaign.bot.username}
            </p>
          )}
        </Link>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <dl className="grid gap-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-slate-400" />
          <dd>{describeSchedule(campaign)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 shrink-0 text-slate-400" />
          <dd>{faNumber(campaign._count.targets)} مقصد</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>
          {campaign.status === "ACTIVE" && campaign.nextRun
            ? `اجرای بعدی: ${formatDateTime(campaign.nextRun, campaign.timezone)}`
            : campaign.lastRunAt
              ? `آخرین اجرا: ${formatDateTime(campaign.lastRunAt, campaign.timezone)}`
              : "هنوز اجرا نشده"}
        </span>
        {lastDelivery && <DeliveryStatusBadge status={lastDelivery.status} />}
      </div>

      <div className="flex flex-wrap gap-2">
        {campaign.status !== "COMPLETED" && (
          <ConfirmedActionButton
            action={setCampaignPausedAction.bind(null, platform, campaign.id, campaign.status === "ACTIVE")}
            pendingLabel="در حال تغییر…"
          >
            {campaign.status === "ACTIVE" ? <Pause /> : <Play />}
            {campaign.status === "ACTIVE" ? "توقف" : "ادامه"}
          </ConfirmedActionButton>
        )}
        <ConfirmedActionButton
          action={runCampaignNowAction.bind(null, platform, campaign.id)}
          confirmTitle="همین حالا ارسال شود؟"
          confirmDescription={`پست یک‌بار فوری به ${faNumber(campaign._count.targets)} مقصد ارسال می‌شود. زمان‌بندی کمپین تغییر نمی‌کند.`}
          pendingLabel="در حال ارسال…"
        >
          <Rocket />
          اجرای فوری
        </ConfirmedActionButton>
        <ConfirmedActionButton
          action={deleteCampaignAction.bind(null, platform, campaign.id)}
          confirmTitle="حذف کمپین؟"
          confirmDescription="کمپین و تاریخچه ارسال‌های آن برای همیشه حذف می‌شود. پست حذف نمی‌شود."
          pendingLabel="در حال حذف…"
          variant="destructive"
        >
          <Trash2 />
          حذف
        </ConfirmedActionButton>
      </div>
    </article>
  );
}
