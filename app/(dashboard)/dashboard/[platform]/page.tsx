import { AlertTriangle, Bot, CalendarClock, CalendarPlus, FilePlus2, Send } from "lucide-react";
import Link from "next/link";

import { DeliveryStatusBadge, EmptyState, PageHeader, Panel } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";
import { postPreviewText } from "@/services/publishing/content";
import { deliveryErrorMessage } from "@/services/publishing/errors";
import { faNumber, formatDateTime } from "@/services/publishing/format";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000);
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const userId = await requirePageUser();
  const { platform } = await params;
  const platformSlug = requirePlatformSlug(platform);
  const platformConfig = platformConfigs[platformSlug];
  const owner = { userId, platform: platformFromSlug(platformSlug) };
  const weekAgo = daysAgo(7);

  const [bots, activeCampaigns, sentThisWeek, upcoming, failures, attention] = await Promise.all([
    prisma.bot.findMany({
      where: owner,
      select: { id: true, username: true, isActive: true, ownerPlatformUserId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaign.count({ where: { bot: owner, status: "ACTIVE" } }),
    prisma.delivery.count({ where: { bot: owner, status: "SENT", sentAt: { gte: weekAgo } } }),
    prisma.campaign.findMany({
      where: { bot: owner, status: "ACTIVE", nextRun: { not: null } },
      orderBy: { nextRun: "asc" },
      take: 6,
      include: {
        post: { select: { title: true, content: true, mediaType: true } },
        _count: { select: { targets: true } },
      },
    }),
    prisma.delivery.findMany({
      where: { bot: owner, status: "FAILED", updatedAt: { gte: weekAgo } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, campaignId: true, chatTitle: true, errorKind: true, updatedAt: true, status: true },
    }),
    prisma.connectedChat.findMany({
      where: { bot: owner, status: { not: "ACTIVE" }, targets: { some: {} } },
      take: 5,
      select: { id: true, botId: true, chatTitle: true, status: true },
    }),
  ]);

  if (!bots.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={`به بات‌ویزارد خوش آمدید`}
          description={`در سه قدم، پست‌های کانال‌ها و گروه‌های ${platformConfig.labelFa} خود را خودکار کنید.`}
        />
        <ol className="grid gap-4">
          {[
            {
              icon: Bot,
              title: "ربات خود را بسازید و وصل کنید",
              text: `از ${platformConfig.tokenIssuer} یک ربات بسازید و توکن آن را اینجا وارد کنید. کمتر از دو دقیقه طول می‌کشد.`,
            },
            {
              icon: Send,
              title: "ربات را به کانال یا گروه اضافه کنید",
              text: "در کانال، ربات را مدیر کنید و اجازه ارسال پیام بدهید. مقصد خودکار ثبت می‌شود.",
            },
            {
              icon: CalendarClock,
              title: "پست بسازید و زمان‌بندی کنید",
              text: "یک‌بار، روزانه، هفتگی یا هر چند ساعت؛ نتیجه هر ارسال را همین‌جا می‌بینید.",
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="dashboard-card flex gap-4 rounded-2xl p-5">
              <span className="dashboard-accent-surface flex size-11 shrink-0 items-center justify-center rounded-2xl">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-black text-slate-900">
                  {faNumber(index + 1)}. {title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button asChild size="lg">
          <Link href={dashboardPath(platformSlug, "bots")}>شروع: افزودن ربات</Link>
        </Button>
      </div>
    );
  }

  const unpaired = bots.filter((bot) => !bot.ownerPlatformUserId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="خانه"
        description={`خلاصه انتشار در ${platformConfig.labelFa}`}
        actions={
          <>
            <Button asChild>
              <Link href={dashboardPath(platformSlug, "campaigns/new")}>
                <CalendarPlus />
                ارسال یا زمان‌بندی
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={dashboardPath(platformSlug, "posts/new")}>
                <FilePlus2 />
                پست جدید
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "ربات", value: bots.length, href: dashboardPath(platformSlug, "bots") },
          { label: "کمپین فعال", value: activeCampaigns, href: dashboardPath(platformSlug, "campaigns") },
          { label: "ارسال موفق در ۷ روز", value: sentThisWeek, href: dashboardPath(platformSlug, "campaigns") },
        ].map((metric) => (
          <Link key={metric.label} href={metric.href} className="dashboard-card rounded-2xl p-5 transition hover:-translate-y-0.5">
            <p className="text-sm font-bold text-slate-500">{metric.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{faNumber(metric.value)}</p>
          </Link>
        ))}
      </div>

      {(failures.length > 0 || attention.length > 0 || unpaired.length > 0) && (
        <Panel title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" />نیاز به توجه</span>}>
          <ul className="space-y-3 text-sm">
            {unpaired.map((bot) => (
              <li key={bot.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  حساب مالک به ربات <b dir="ltr">@{bot.username}</b> متصل نیست.
                </span>
                <Link className="text-xs font-bold text-primary" href={dashboardPath(platformSlug, `bots/${bot.id}`)}>
                  اتصال حساب
                </Link>
              </li>
            ))}
            {attention.map((destination) => (
              <li key={destination.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  ربات در «{destination.chatTitle}» {destination.status === "REMOVED" ? "دیگر عضو نیست" : "اجازه ارسال ندارد"}.
                </span>
                <Link className="text-xs font-bold text-primary" href={dashboardPath(platformSlug, `bots/${destination.botId}`)}>
                  رفع مشکل
                </Link>
              </li>
            ))}
            {failures.map((failure) => (
              <li key={failure.id} className="flex flex-wrap items-start justify-between gap-2">
                <span className="space-y-1">
                  <span className="flex items-center gap-2">
                    <DeliveryStatusBadge status={failure.status} />
                    <b>{failure.chatTitle}</b>
                    <span className="text-xs text-slate-400">{formatDateTime(failure.updatedAt, "Asia/Tehran")}</span>
                  </span>
                  <span className="block text-xs leading-5 text-slate-500">{deliveryErrorMessage(failure.errorKind)}</span>
                </span>
                <Link className="text-xs font-bold text-primary" href={dashboardPath(platformSlug, `campaigns/${failure.campaignId}`)}>
                  جزئیات
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="ارسال‌های پیش رو"
        actions={
          <Link href={dashboardPath(platformSlug, "campaigns")} className="text-xs font-bold text-primary">
            همه کمپین‌ها
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState
            title="ارسال زمان‌بندی‌شده‌ای در پیش نیست"
            action={
              <Button asChild size="sm">
                <Link href={dashboardPath(platformSlug, "campaigns/new")}>ساخت زمان‌بندی</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {upcoming.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={dashboardPath(platformSlug, `campaigns/${campaign.id}`)}
                  className="flex flex-col gap-1 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-2"
                >
                  <span className="line-clamp-1 font-bold text-slate-800">
                    {campaign.name || campaign.post.title || postPreviewText(campaign.post, 60)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(campaign.nextRun!, campaign.timezone)} · {faNumber(campaign._count.targets)} مقصد
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
