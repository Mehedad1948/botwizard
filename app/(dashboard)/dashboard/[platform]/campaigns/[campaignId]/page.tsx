import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { TopicCreateForm } from "@/components/dashboard/TopicCreateForm";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  ImageIcon,
  Pause,
  Play,
  Plus,
  Send,
  Tags,
  Video,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateCampaignForm } from "../../posts/CreateCampaignForm";
import {
  addCampaignTopicAction,
  createCampaignTopicAction,
  removeCampaignTopicAction,
  toggleCampaignAction,
  toggleCampaignSubscriberNotificationsAction,
} from "../actions";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ platform: string; campaignId: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const { platform, campaignId } = await params;
  const platformSlug = requirePlatformSlug(platform);
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platformSlug),
      },
    },
    include: {
      bot: {
        select: {
          id: true,
          username: true,
          isActive: true,
          connectedChats: {
            select: { id: true, chatTitle: true },
            orderBy: { chatTitle: "asc" },
          },
          notificationTopics: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, name: true },
          },
        },
      },
      post: {
        include: {
          notificationTopics: {
            include: { topic: true },
          },
        },
      },
      history: {
        orderBy: { sentAt: "desc" },
        take: 8,
      },
      _count: { select: { history: true } },
    },
  });

  if (!campaign) notFound();

  const assignedTopicIds = new Set(
    campaign.post.notificationTopics.map((item) => item.topicId),
  );
  const availableTopics = campaign.bot.notificationTopics.filter(
    (topic) => !assignedTopicIds.has(topic.id),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link href={dashboardPath(platformSlug, "campaigns")}>
              <ArrowRight />
              بازگشت به کمپین‌ها
            </Link>
          </Button>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
            جزئیات کمپین {campaign.chatTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            تنظیمات کمپین و پست مرتبط را در یک صفحه مدیریت کنید.
          </p>
        </div>

        <ConfirmedActionButton
          action={toggleCampaignAction.bind(
            null,
            platformSlug,
            campaign.id,
          )}
          pendingLabel="در حال تغییر..."
          variant="default"
          size="brand-sm"
        >
          {campaign.isActive ? <Pause /> : <Play />}
          {campaign.isActive ? "توقف کمپین" : "فعال‌سازی کمپین"}
        </ConfirmedActionButton>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailMetric
          icon={<CalendarClock />}
          label="وضعیت"
          value={campaign.isActive ? "فعال" : "متوقف"}
        />
        <DetailMetric
          icon={<Clock3 />}
          label="اجرای بعدی"
          value={tehranDateTime.format(campaign.nextRun)}
        />
        <DetailMetric
          icon={<Bot />}
          label="ربات"
          value={`@${campaign.bot.username}`}
          dir="ltr"
        />
        <DetailMetric
          icon={<Send />}
          label="ارسال‌های ثبت‌شده"
          value={campaign._count.history.toLocaleString("fa-IR")}
        />
      </section>

      <section className="dashboard-card flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-slate-950">
            اعلان خصوصی به مشترک‌های منطبق
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {campaign.post.notificationTopics.length
              ? `موضوع‌ها: ${campaign.post.notificationTopics
                  .map((item) => item.topic.name)
                  .join("، ")}`
              : "هنوز موضوع فعالی به این پست اختصاص داده نشده است."}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            فقط کاربران فعالی که ربات را خصوصی شروع کرده‌اند و موضوع منطبق دارند
            اعلان می‌گیرند.
          </p>
        </div>
        <ConfirmedActionButton
          action={toggleCampaignSubscriberNotificationsAction.bind(
            null,
            platformSlug,
            campaign.id,
          )}
          variant={campaign.notifySubscribers ? "outline" : "default"}
          pendingLabel="در حال تغییر..."
        >
          {campaign.notifySubscribers ? <Pause /> : <Send />}
          {campaign.notifySubscribers
            ? "غیرفعال‌کردن اعلان مشترک‌ها"
            : "فعال‌کردن اعلان مشترک‌ها"}
        </ConfirmedActionButton>
      </section>

      <section className="dashboard-card space-y-5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="dashboard-accent-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Tags className="size-4" />
          </span>
          <div>
            <h2 className="font-black text-slate-950">
              موضوع‌های اعلان کمپین
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              موضوع‌ها به پست این کمپین متصل می‌شوند و برای کمپین‌های دیگری که
              از همین پست استفاده می‌کنند نیز یکسان هستند.
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-slate-500">
            موضوع‌های انتخاب‌شده
          </p>
          {campaign.post.notificationTopics.length ? (
            <div className="flex flex-wrap gap-2">
              {campaign.post.notificationTopics.map(({ topic }) => (
                <div
                  key={topic.id}
                  className="dashboard-accent-surface inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-xs font-bold"
                >
                  {topic.name}
                  {!topic.isActive && (
                    <span className="text-amber-700">(غیرفعال)</span>
                  )}
                  <ConfirmedActionButton
                    action={removeCampaignTopicAction.bind(
                      null,
                      platformSlug,
                      campaign.id,
                      topic.id,
                    )}
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    pendingLabel="..."
                    ariaLabel={`حذف موضوع ${topic.name}`}
                  >
                    <X className="size-3.5" />
                  </ConfirmedActionButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              هنوز موضوعی به این کمپین اختصاص داده نشده است.
            </p>
          )}
        </div>

        {availableTopics.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">
              افزودن از موضوع‌های فعال ربات
            </p>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((topic) => (
                <ConfirmedActionButton
                  key={topic.id}
                  action={addCampaignTopicAction.bind(
                    null,
                    platformSlug,
                    campaign.id,
                    topic.id,
                  )}
                  variant="outline"
                  size="sm"
                  pendingLabel="در حال افزودن..."
                >
                  <Plus />
                  {topic.name}
                </ConfirmedActionButton>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-bold text-slate-500">
            ایجاد موضوع جدید و اختصاص مستقیم به کمپین
          </p>
          <TopicCreateForm
            action={createCampaignTopicAction.bind(
              null,
              platformSlug,
              campaign.id,
            )}
            compact
            submitLabel="ایجاد و اختصاص موضوع"
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:space-y-0 [&_[role=alert]]:sm:col-span-2 [&_[role=status]]:sm:col-span-2 [&_button]:sm:w-auto"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <article className="dashboard-card space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="dashboard-accent-text text-xs font-black">پست مرتبط</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">
                محتوای انتخاب‌شده برای این کمپین
              </h2>
            </div>
            <span className="dashboard-accent-surface flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              {campaign.post.mediaType === "IMAGE" ? (
                <ImageIcon className="size-3.5" />
              ) : campaign.post.mediaType === "VIDEO" ? (
                <Video className="size-3.5" />
              ) : (
                <FileText className="size-3.5" />
              )}
              {campaign.post.mediaType === "NONE"
                ? "متن"
                : campaign.post.mediaType}
            </span>
          </div>

          <div className="dashboard-accent-surface min-h-36 rounded-2xl border p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {campaign.post.content || "محتوای رسانه‌ای بدون متن"}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>
              ثبت پست: {tehranDateTime.format(campaign.post.createdAt)}
            </span>
            <span>
              برنامه:{" "}
              {campaign.scheduleType === "SPECIFIC_TIMES"
                ? `روزانه در ${campaign.specificTimes.join("، ")}`
                : `هر ${campaign.intervalHours} ساعت`}
            </span>
          </div>

          <CreateCampaignForm
            platform={platformSlug}
            postId={campaign.post.id}
            destinations={campaign.bot.connectedChats}
            hasNotificationTopics={campaign.post.notificationTopics.some(
              (item) => item.topic.isActive,
            )}
          />
        </article>

        <aside className="space-y-4">
          <div className="dashboard-card rounded-2xl p-5">
            <h2 className="font-black text-slate-950">مقصد کمپین</h2>
            <p className="mt-3 text-sm font-bold text-slate-700">
              {campaign.chatTitle}
            </p>
            <p className="mt-1 text-xs text-slate-400" dir="ltr">
              {campaign.chatId}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link
                href={dashboardPath(
                  platformSlug,
                  `bots/${campaign.bot.id}`,
                )}
              >
                <Bot />
                مشاهده ربات
              </Link>
            </Button>
          </div>

          <div className="dashboard-card rounded-2xl p-5">
            <h2 className="font-black text-slate-950">آخرین اجراها</h2>
            {campaign.history.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                هنوز سابقه ارسالی برای این کمپین ثبت نشده است.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {campaign.history.map((history) => (
                  <div
                    key={history.id}
                    className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    {history.status === "SUCCESS" ? (
                      <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 text-red-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        {history.status === "SUCCESS"
                          ? "ارسال موفق"
                          : "ارسال ناموفق"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {tehranDateTime.format(history.sentAt)}
                      </p>
                      {history.errorLog && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-red-500">
                          {history.errorLog}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailMetric({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="dashboard-card rounded-2xl p-4">
      <div className="dashboard-accent-text flex items-center gap-2 [&_svg]:size-4">
        {icon}
        <span className="text-xs font-black">{label}</span>
      </div>
      <p
        className="mt-3 truncate text-sm font-black text-slate-900"
        dir={dir}
      >
        {value}
      </p>
    </div>
  );
}
