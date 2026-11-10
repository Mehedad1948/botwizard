import { Bell, Pause, Pencil, Play, Plus, Rocket, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { TopicCreateForm } from "@/components/dashboard/TopicCreateForm";
import { CampaignForm } from "@/components/publishing/CampaignForm";
import {
  CampaignStatusBadge,
  DeliveryStatusBadge,
  DestinationStatusBadge,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";
import { loadCampaignFormData } from "@/services/dashboard/publishing";
import {
  MEDIA_TYPE_LABELS,
  parseButtons,
  postPreviewText,
} from "@/services/publishing/content";
import { deliveryErrorMessage } from "@/services/publishing/errors";
import {
  describeSchedule,
  faNumber,
  formatDateTime,
} from "@/services/publishing/format";
import { nextOccurrence, wallClock } from "@/services/publishing/schedule";
import {
  addCampaignTopicAction,
  createCampaignTopicAction,
  deleteCampaignAction,
  removeCampaignTopicAction,
  runCampaignNowAction,
  setCampaignPausedAction,
  toggleCampaignSubscriberNotificationsAction,
} from "../actions";

function toLocalInput(date: Date | null, timeZone: string) {
  if (!date) return "";
  const clock = wallClock(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}`;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ platform: string; campaignId: string }>;
}) {
  const userId = await requirePageUser();
  const { platform, campaignId } = await params;
  const platformSlug = requirePlatformSlug(platform);

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: { userId, platform: platformFromSlug(platformSlug) },
    },
    include: {
      bot: {
        select: {
          id: true,
          username: true,
          isActive: true,
          notificationTopics: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, name: true },
          },
        },
      },
      post: { include: { notificationTopics: { include: { topic: true } } } },
      targets: { include: { destination: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 150 },
    },
  });
  if (!campaign) notFound();

  const title =
    campaign.name || campaign.post.title || postPreviewText(campaign.post, 60);
  const formData = await loadCampaignFormData(campaign.botId, campaign.postId);

  const upcoming: Date[] = [];
  if (campaign.status === "ACTIVE" && campaign.nextRun) {
    let cursor: Date | null = campaign.nextRun;
    for (let index = 0; cursor && index < 5; index += 1) {
      upcoming.push(cursor);
      cursor = nextOccurrence(
        { ...campaign, runCount: campaign.runCount + index + 1 },
        cursor,
      );
    }
  }

  const occurrences = new Map<string, typeof campaign.deliveries>();
  for (const delivery of campaign.deliveries) {
    occurrences.set(delivery.occurrenceKey, [
      ...(occurrences.get(delivery.occurrenceKey) ?? []),
      delivery,
    ]);
  }
  const sentCount = campaign.deliveries.filter((d) => d.status === "SENT").length;
  const failedCount = campaign.deliveries.filter((d) => d.status === "FAILED").length;
  const buttons = parseButtons(campaign.post.buttons).flat();
  const assignedTopicIds = new Set(campaign.post.notificationTopics.map((item) => item.topicId));
  const availableTopics = campaign.bot.notificationTopics.filter((topic) => !assignedTopicIds.has(topic.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: dashboardPath(platformSlug, "campaigns"), label: "کمپین‌ها" }}
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span dir="ltr">@{campaign.bot.username}</span>
            {!campaign.bot.isActive && (
              <span className="text-amber-700">ربات غیرفعال است؛ ارسالی انجام نمی‌شود.</span>
            )}
          </span>
        }
        actions={
          <>
            {campaign.status !== "COMPLETED" && (
              <ConfirmedActionButton
                action={setCampaignPausedAction.bind(null, platformSlug, campaign.id, campaign.status === "ACTIVE")}
                pendingLabel="در حال تغییر…"
                size="default"
              >
                {campaign.status === "ACTIVE" ? <Pause /> : <Play />}
                {campaign.status === "ACTIVE" ? "توقف" : "ادامه"}
              </ConfirmedActionButton>
            )}
            <ConfirmedActionButton
              action={runCampaignNowAction.bind(null, platformSlug, campaign.id)}
              confirmTitle="همین حالا ارسال شود؟"
              confirmDescription={`پست یک‌بار فوری به ${faNumber(campaign.targets.length)} مقصد ارسال می‌شود. زمان‌بندی تغییر نمی‌کند.`}
              pendingLabel="در حال ارسال…"
              size="default"
            >
              <Rocket />
              اجرای فوری
            </ConfirmedActionButton>
            <ConfirmedActionButton
              action={deleteCampaignAction.bind(null, platformSlug, campaign.id)}
              confirmTitle="حذف کمپین؟"
              confirmDescription="کمپین و تاریخچه ارسال‌های آن برای همیشه حذف می‌شود. پست حذف نمی‌شود."
              pendingLabel="در حال حذف…"
              variant="destructive"
              size="default"
            >
              <Trash2 />
              حذف
            </ConfirmedActionButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-6">
          <Panel title="زمان‌بندی">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">برنامه</dt>
                <dd className="mt-1 font-bold text-slate-900">{describeSchedule(campaign)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">اجراهای انجام‌شده</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {faNumber(campaign.runCount)}
                  {campaign.maxRuns ? ` از ${faNumber(campaign.maxRuns)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">نتیجه ارسال‌ها</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {faNumber(sentCount)} موفق · {faNumber(failedCount)} ناموفق
                </dd>
              </div>
            </dl>
            {upcoming.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-bold text-slate-500">ارسال‌های بعدی</p>
                <ol className="flex flex-wrap gap-2">
                  {upcoming.map((date) => (
                    <li key={date.toISOString()} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                      {formatDateTime(date, campaign.timezone)}
                    </li>
                  ))}
                </ol>
                {campaign.jitterMinutes > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    هر ارسال تا {faNumber(campaign.jitterMinutes)} دقیقه تأخیر تصادفی دارد.
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="تاریخچه ارسال"
            description="هر اجرا جداگانه نمایش داده می‌شود. علت ارسال‌های ناموفق کنار هر مقصد آمده است."
          >
            {occurrences.size === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                {campaign.nextRun
                  ? `اولین ارسال ${formatDateTime(campaign.nextRun, campaign.timezone)} انجام می‌شود.`
                  : "هنوز ارسالی انجام نشده است."}
              </p>
            ) : (
              <div className="space-y-4">
                {[...occurrences.entries()].slice(0, 20).map(([key, rows]) => (
                  <div key={key} className="rounded-xl border">
                    <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-bold text-slate-700">
                        {formatDateTime(rows[0].sentAt ?? rows[0].runAt, campaign.timezone)}
                      </span>
                      <span className="text-slate-500">
                        {rows[0].trigger === "MANUAL" ? "ارسال دستی" : "زمان‌بندی‌شده"}
                      </span>
                    </div>
                    <ul className="divide-y">
                      {rows.map((delivery) => (
                        <li key={delivery.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between">
                          <span className="font-bold text-slate-800">{delivery.chatTitle}</span>
                          <span className="flex flex-col items-start gap-1 sm:items-end">
                            <DeliveryStatusBadge status={delivery.status} />
                            {(delivery.status === "FAILED" ||
                              delivery.status === "SKIPPED" ||
                              (delivery.status === "PENDING" && delivery.errorKind)) && (
                              <span className="max-w-sm text-xs leading-5 text-slate-500 sm:text-left" title={delivery.errorMessage ?? undefined}>
                                {deliveryErrorMessage(delivery.errorKind)}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <details className="group" id="edit">
            <summary className="dashboard-card flex cursor-pointer items-center gap-2 rounded-2xl p-5 text-base font-black text-slate-900">
              <Pencil className="size-4" />
              ویرایش کمپین
            </summary>
            <div className="mt-4">
              <CampaignForm
                platform={platformSlug}
                botId={campaign.botId}
                {...formData}
                initial={{
                  campaignId: campaign.id,
                  postId: campaign.postId,
                  destinationIds: campaign.targets.map((target) => target.destinationId),
                  name: campaign.name ?? "",
                  scheduleKind: campaign.scheduleKind,
                  intervalMinutes: campaign.intervalMinutes,
                  times: campaign.times,
                  weekdays: campaign.weekdays,
                  startsAtLocal:
                    campaign.scheduleKind === "ONCE" ||
                    (campaign.scheduleKind === "INTERVAL" && campaign.startsAt > new Date())
                      ? toLocalInput(campaign.startsAt, campaign.timezone)
                      : "",
                  endsAtLocal: toLocalInput(campaign.endsAt, campaign.timezone),
                  maxRuns: campaign.maxRuns,
                  jitterMinutes: campaign.jitterMinutes,
                  notifySubscribers: campaign.notifySubscribers,
                }}
              />
            </div>
          </details>
        </div>

        <aside className="space-y-6">
          <Panel
            title="پست"
            actions={
              <Link
                href={dashboardPath(platformSlug, `posts/${campaign.postId}`)}
                className="text-xs font-bold text-primary"
              >
                ویرایش پست
              </Link>
            }
          >
            <p className="mb-2 text-xs text-slate-500">{MEDIA_TYPE_LABELS[campaign.post.mediaType]}</p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
              {postPreviewText(campaign.post, 600)}
            </p>
            {buttons.length > 0 && (
              <div className="mt-3 grid gap-1.5">
                {buttons.map((button) => (
                  <span key={button.url + button.text} className="rounded-lg bg-slate-100 px-3 py-1.5 text-center text-xs font-bold text-slate-700">
                    {button.text}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={`مقصدها (${faNumber(campaign.targets.length)})`}>
            {campaign.targets.length === 0 ? (
              <EmptyState title="مقصدی باقی نمانده است">
                مقصدهای این کمپین حذف شده‌اند. کمپین را ویرایش کنید و مقصد جدید انتخاب کنید.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {campaign.targets.map(({ destination }) => (
                  <li key={destination.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-bold text-slate-800">{destination.chatTitle}</span>
                    <DestinationStatusBadge status={destination.status} />
                  </li>
                ))}
              </ul>
            )}
            {campaign.targets.some(({ destination }) => destination.status !== "ACTIVE") && (
              <p className="mt-3 text-xs leading-5 text-amber-700">
                به مقصدهای بدون دسترسی ارسال نمی‌شود.{" "}
                <Link className="font-bold underline" href={dashboardPath(platformSlug, `bots/${campaign.botId}`)}>
                  بررسی و رفع مشکل
                </Link>
              </p>
            )}
          </Panel>

          <Panel
            title="اعلان خصوصی به مشترک‌ها"
            description="مشترک‌هایی که موضوع‌های این پست را در ربات انتخاب کرده‌اند، نسخه خصوصی دریافت می‌کنند."
          >
            <div className="space-y-4">
              <ConfirmedActionButton
                action={toggleCampaignSubscriberNotificationsAction.bind(null, platformSlug, campaign.id)}
                pendingLabel="در حال تغییر…"
                variant={campaign.notifySubscribers ? "outline" : "default"}
              >
                <Bell />
                {campaign.notifySubscribers ? "غیرفعال کردن اعلان" : "فعال کردن اعلان"}
              </ConfirmedActionButton>

              <div className="flex flex-wrap gap-2">
                {campaign.post.notificationTopics.map(({ topic }) => (
                  <span key={topic.id} className="dashboard-accent-surface inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-xs font-bold">
                    {topic.name}
                    <ConfirmedActionButton
                      action={removeCampaignTopicAction.bind(null, platformSlug, campaign.id, topic.id)}
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-full text-red-600"
                      pendingLabel="…"
                      ariaLabel={`حذف موضوع ${topic.name}`}
                    >
                      <X className="size-3" />
                    </ConfirmedActionButton>
                  </span>
                ))}
                {availableTopics.map((topic) => (
                  <ConfirmedActionButton
                    key={topic.id}
                    action={addCampaignTopicAction.bind(null, platformSlug, campaign.id, topic.id)}
                    variant="outline"
                    size="sm"
                    pendingLabel="…"
                  >
                    <Plus />
                    {topic.name}
                  </ConfirmedActionButton>
                ))}
              </div>
              <TopicCreateForm
                action={createCampaignTopicAction.bind(null, platformSlug, campaign.id)}
                compact
                submitLabel="موضوع جدید"
              />
            </div>
          </Panel>

          <Button asChild variant="outline" className="w-full">
            <Link href={dashboardPath(platformSlug, `campaigns/new?botId=${campaign.botId}&postId=${campaign.postId}`)}>
              کمپین دیگری با همین پست
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
