import {
  Bell,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ExternalLink,
  FilePlus2,
  LogOut,
  Power,
  RefreshCw,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { CampaignCard, campaignCardInclude } from "@/components/dashboard/CampaignCard";
import { DestinationStatusBadge, EmptyState, PageHeader, Panel } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { dashboardPath, platformConfigs } from "@/services/bot-platforms/config";
import { getConnectionStatus } from "@/services/bots/connection";
import { requirePageBot } from "@/services/dashboard/access";
import {
  CHAT_TYPE_LABELS,
  destinationStatusHelp,
} from "@/services/publishing/destinations";
import { faNumber, formatDateTime } from "@/services/publishing/format";
import { PairingCodeButton } from "../PairingCodeButton";
import {
  checkDestinationAction,
  leaveConnectedChatAction,
  repairConnectionAction,
  toggleBotStatusAction,
} from "./actions";

export default async function BotWorkspacePage({
  params,
}: {
  params: Promise<{ platform: string; botId: string }>;
}) {
  const { platform, botId } = await params;
  const { platformSlug, bot } = await requirePageBot(platform, botId);
  const platformConfig = platformConfigs[platformSlug];

  const [destinations, postCount, campaignCount, campaigns, connection] = await Promise.all([
    prisma.connectedChat.findMany({
      where: { botId: bot.id },
      orderBy: [{ status: "asc" }, { chatTitle: "asc" }],
      include: { _count: { select: { targets: true } } },
    }),
    prisma.post.count({ where: { botId: bot.id, archivedAt: null } }),
    prisma.campaign.count({ where: { botId: bot.id } }),
    prisma.campaign.findMany({
      where: { botId: bot.id, status: { not: "COMPLETED" } },
      include: campaignCardInclude,
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    getConnectionStatus(bot).catch(() => null),
  ]);

  const activeDestinations = destinations.filter((d) => d.status === "ACTIVE").length;
  const connected = Boolean(connection?.ok);
  const steps = [
    { done: connected, label: "اتصال ربات به سامانه", hint: "وب‌هوک ربات فعال و سالم است." },
    {
      done: Boolean(bot.ownerPlatformUserId),
      label: "اتصال حساب مالک",
      hint: "برای مدیریت از داخل ربات و دریافت پیش‌نمایش لازم است.",
    },
    {
      done: activeDestinations > 0,
      label: "افزودن کانال یا گروه",
      hint: "ربات را به مقصد اضافه کنید؛ در کانال باید مدیر با اجازه ارسال باشد.",
    },
    { done: postCount > 0, label: "ساخت اولین پست", hint: "در داشبورد یا با فرستادن محتوا برای ربات." },
    { done: campaignCount > 0, label: "اولین ارسال یا زمان‌بندی", hint: "پست را فوری بفرستید یا زمان‌بندی کنید." },
  ];
  const pendingSteps = steps.filter((step) => !step.done).length;
  const telegram = platformSlug === "telegram";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: dashboardPath(platformSlug, "bots"), label: "ربات‌ها" }}
        title={<span dir="ltr">@{bot.username}</span>}
        description={
          bot.isActive
            ? "ربات فعال است و ارسال‌ها انجام می‌شوند."
            : "ربات غیرفعال است؛ ارسال‌ها و پاسخ‌گویی متوقف شده‌اند."
        }
        actions={
          <>
            <Button asChild>
              <Link href={`${dashboardPath(platformSlug, "campaigns/new")}?botId=${bot.id}`}>
                <CalendarPlus />
                ارسال یا زمان‌بندی
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${dashboardPath(platformSlug, "posts/new")}?botId=${bot.id}`}>
                <FilePlus2 />
                پست جدید
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={platformConfig.botUrl(bot.username)} target="_blank" rel="noreferrer">
                <ExternalLink />
                باز کردن در {platformConfig.labelFa}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={dashboardPath(platformSlug, `bots/${bot.id}/notifications`)}>
                <Bell />
                مشترک‌ها و اعلان‌ها
              </Link>
            </Button>
            <ConfirmedActionButton
              action={toggleBotStatusAction.bind(null, platformSlug, bot.id)}
              pendingLabel="در حال تغییر…"
              size="default"
              confirmTitle={bot.isActive ? "ربات غیرفعال شود؟" : undefined}
              confirmDescription={bot.isActive ? "تا فعال‌سازی دوباره، هیچ ارسال زمان‌بندی‌شده‌ای انجام نمی‌شود." : undefined}
            >
              <Power />
              {bot.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
            </ConfirmedActionButton>
          </>
        }
      />

      {pendingSteps > 0 && (
        <Panel
          title="راه‌اندازی ربات"
          description={`${faNumber(steps.length - pendingSteps)} از ${faNumber(steps.length)} مرحله انجام شده است.`}
        >
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <li
                key={step.label}
                className={`rounded-xl border p-3 ${step.done ? "border-emerald-200 bg-emerald-50/60" : "bg-white"}`}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4 text-slate-300" />
                  )}
                  {step.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.hint}</p>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-6">
          <Panel
            title={`مقصدها (${faNumber(destinations.length)})`}
            description="کانال‌ها و گروه‌هایی که ربات در آن‌ها عضو است. وضعیت با هر ارسال به‌روز می‌شود."
          >
            <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              <p className="font-bold text-slate-800">افزودن مقصد جدید</p>
              <p>
                ربات را به کانال یا گروه اضافه کنید. در کانال، ربات باید <b>مدیر</b> باشد و اجازه «ارسال پیام» داشته باشد. پس از اضافه شدن، مقصد خودکار اینجا ظاهر می‌شود
                {bot.ownerPlatformUserId ? " و در ربات هم به شما خبر داده می‌شود." : "."}
              </p>
              {telegram && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages`} target="_blank" rel="noreferrer">
                      افزودن به کانال
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://t.me/${bot.username}?startgroup&admin=post_messages`} target="_blank" rel="noreferrer">
                      افزودن به گروه
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {destinations.length === 0 ? (
              <EmptyState title="هنوز مقصدی ثبت نشده است">
                بعد از افزودن ربات به کانال یا گروه، این صفحه را تازه کنید.
              </EmptyState>
            ) : (
              <ul className="divide-y rounded-xl border">
                {destinations.map((destination) => (
                  <li key={destination.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{destination.chatTitle}</span>
                        <DestinationStatusBadge status={destination.status} />
                      </p>
                      <p className="text-xs text-slate-500">
                        {CHAT_TYPE_LABELS[destination.chatType]} · {faNumber(destination._count.targets)} کمپین
                        {destination.lastCheckedAt &&
                          ` · بررسی: ${formatDateTime(destination.lastCheckedAt, "Asia/Tehran")}`}
                      </p>
                      {destination.status !== "ACTIVE" && (
                        <p className="text-xs leading-5 text-amber-700">{destinationStatusHelp(destination.status)}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <ConfirmedActionButton
                        action={checkDestinationAction.bind(null, platformSlug, bot.id, destination.id)}
                        pendingLabel="در حال بررسی…"
                      >
                        <RefreshCw />
                        بررسی دسترسی
                      </ConfirmedActionButton>
                      <ConfirmedActionButton
                        action={leaveConnectedChatAction.bind(null, platformSlug, bot.id, destination.id)}
                        confirmTitle="حذف این مقصد؟"
                        confirmDescription={`ربات از «${destination.chatTitle}» خارج می‌شود و این مقصد از ${faNumber(destination._count.targets)} کمپین حذف می‌شود. تاریخچه ارسال‌ها حفظ می‌شود.`}
                        pendingLabel="در حال حذف…"
                        variant="destructive"
                      >
                        <LogOut />
                        حذف
                      </ConfirmedActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="کمپین‌های جاری"
            actions={
              <Link href={dashboardPath(platformSlug, "campaigns")} className="text-xs font-bold text-primary">
                همه کمپین‌ها
              </Link>
            }
          >
            {campaigns.length === 0 ? (
              <EmptyState title="کمپین جاری ندارید">
                پست را فوری بفرستید یا برای ارسال روزانه، هفتگی یا تکراری زمان‌بندی کنید.
              </EmptyState>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {campaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} platform={platformSlug} showBot={false} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="وضعیت اتصال">
            {connection ? (
              <div className="space-y-2 text-sm">
                <p className={`font-bold ${connected ? "text-emerald-700" : "text-amber-700"}`}>
                  {connected
                    ? "ربات به‌درستی به سامانه متصل است."
                    : !connection.usesCurrentUrl
                      ? "اتصال ربات قدیمی یا نادرست است."
                      : "پیام‌رسان در تحویل پیام‌ها به سامانه خطا داشته است."}
                </p>
                {connection.lastError && (
                  <p className="text-xs leading-5 text-slate-500" dir="ltr">
                    {connection.lastError}
                  </p>
                )}
                {connection.pendingUpdates > 0 && (
                  <p className="text-xs text-slate-500">
                    {faNumber(connection.pendingUpdates)} پیام در انتظار تحویل
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                وضعیت اتصال از {platformConfig.labelFa} دریافت نشد. اگر توکن ربات تغییر کرده، ربات را حذف و دوباره اضافه کنید.
              </p>
            )}
            {!connected && (
              <div className="mt-4">
                <ConfirmedActionButton
                  action={repairConnectionAction.bind(null, platformSlug, bot.id)}
                  pendingLabel="در حال اتصال…"
                  size="default"
                >
                  <Wrench />
                  اتصال دوباره
                </ConfirmedActionButton>
              </div>
            )}
          </Panel>

          <Panel title="حساب مالک">
            {bot.ownerPlatformUserId ? (
              <p className="text-sm leading-6 text-slate-600">
                حساب شما به ربات متصل است. در گفت‌وگوی خصوصی با ربات، /start را بفرستید تا منوی مدیریت را ببینید.
              </p>
            ) : (
              <PairingCodeButton platform={platformSlug} botId={bot.id} />
            )}
          </Panel>

          <Panel title="محتوا">
            <p className="text-sm text-slate-600">{faNumber(postCount)} پست آماده انتشار</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`${dashboardPath(platformSlug, "posts")}?botId=${bot.id}`}>مشاهده پست‌ها</Link>
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
