import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Clock3,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import type {
  NotificationDispatchStatus,
  Prisma,
  SubscriberStatus,
} from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { TopicCreateForm } from "@/components/dashboard/TopicCreateForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import {
  createTopicAction,
  deleteTopicAction,
  toggleTopicAction,
  updateTopicAction,
} from "./actions";

const pageSize = 20;
const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function BotNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; botId: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    topic?: string;
    page?: string;
    dispatchStatus?: string;
    dpage?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  const { platform, botId } = await params;
  const query = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const page = Math.max(1, Number(query.page) || 1);
  const dispatchPage = Math.max(1, Number(query.dpage) || 1);
  const status: SubscriberStatus | undefined =
    query.status === "ACTIVE" ||
    query.status === "UNSUBSCRIBED" ||
    query.status === "BLOCKED"
      ? query.status
      : undefined;
  const dispatchStatus: NotificationDispatchStatus | undefined =
    query.dispatchStatus === "PENDING" ||
    query.dispatchStatus === "SENT" ||
    query.dispatchStatus === "FAILED" ||
    query.dispatchStatus === "SKIPPED" ||
    query.dispatchStatus === "BLOCKED"
      ? query.dispatchStatus
      : undefined;
  const search = query.q?.trim().slice(0, 80);

  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      userId: session.userId,
      platform: platformFromSlug(platformSlug),
    },
    select: {
      id: true,
      username: true,
      notificationTopics: {
        include: {
          _count: { select: { subscriptions: true, posts: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!bot) notFound();

  const subscriberWhere: Prisma.BotSubscriberWhereInput = {
    botId: bot.id,
    ...(status ? { status } : {}),
    ...(query.topic
      ? {
          subscriptions: {
            some: { topicId: query.topic, isEnabled: true },
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { platformUserId: { contains: search } },
          ],
        }
      : {}),
  };

  const [subscribers, subscriberCount, dispatches, dispatchCount] = await Promise.all([
    prisma.botSubscriber.findMany({
      where: subscriberWhere,
      include: {
        subscriptions: {
          where: { isEnabled: true },
          select: { topic: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.botSubscriber.count({ where: subscriberWhere }),
    prisma.subscriberNotificationDispatch.findMany({
      where: { botId: bot.id, ...(dispatchStatus ? { status: dispatchStatus } : {}) },
      include: {
        subscriber: {
          select: {
            username: true,
            firstName: true,
            platformUserId: true,
          },
        },
        campaign: { select: { chatTitle: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (dispatchPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscriberNotificationDispatch.count({
      where: { botId: bot.id, ...(dispatchStatus ? { status: dispatchStatus } : {}) },
    }),
  ]);

  const path = dashboardPath(
    platformSlug,
    `bots/${bot.id}/notifications`,
  );
  const totalPages = Math.max(1, Math.ceil(subscriberCount / pageSize));
  const dispatchTotalPages = Math.max(1, Math.ceil(dispatchCount / pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link href={dashboardPath(platformSlug, `bots/${bot.id}`)}>
              بازگشت به ربات
              <ChevronLeft />
            </Link>
          </Button>
          <h1 className="flex items-center gap-3 text-2xl font-black text-slate-950">
            <span className="dashboard-accent-icon flex size-11 items-center justify-center rounded-2xl">
              <Bell className="size-5" />
            </span>
            اعلان‌ها و مخاطبان @{bot.username}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            موضوع‌های اعلان، کاربران خصوصی ربات و نتیجه ارسال‌های شخصی را مدیریت کنید.
          </p>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="dashboard-card h-fit space-y-4 rounded-2xl p-5">
          <div>
            <h2 className="flex items-center gap-2 font-black text-slate-950">
              <Plus className="dashboard-accent-text size-4" />
              موضوع جدید
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              موضوع‌ها برای هر ربات مستقل هستند.
            </p>
          </div>
          <TopicCreateForm
            action={createTopicAction.bind(null, platformSlug, bot.id)}
          />
        </div>

        <div className="space-y-3">
          {bot.notificationTopics.length === 0 ? (
            <EmptyState text="هنوز موضوع اعلانی ایجاد نشده است." />
          ) : (
            bot.notificationTopics.map((topic) => (
              <article
                key={topic.id}
                className="dashboard-card rounded-2xl p-5"
              >
                <form
                  action={async (formData) => {
                    "use server";
                    await updateTopicAction(
                      platformSlug,
                      bot.id,
                      topic.id,
                      formData,
                    );
                  }}
                  className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                >
                  <Input name="name" defaultValue={topic.name} required maxLength={80} />
                  <Input
                    name="description"
                    defaultValue={topic.description ?? ""}
                    maxLength={240}
                    placeholder="توضیح موضوع"
                  />
                  <Button type="submit" variant="outline">
                    ذخیره
                  </Button>
                </form>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      {topic._count.subscriptions.toLocaleString("fa-IR")} اشتراک
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      {topic._count.posts.toLocaleString("fa-IR")} پست
                    </span>
                    <span
                      className={
                        topic.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
                          : "rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"
                      }
                    >
                      {topic.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmedActionButton
                      action={toggleTopicAction.bind(
                        null,
                        platformSlug,
                        bot.id,
                        topic.id,
                        !topic.isActive,
                      )}
                      variant="outline"
                      size="sm"
                    >
                      {topic.isActive ? <BellOff /> : <CheckCircle2 />}
                      {topic.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </ConfirmedActionButton>
                    <ConfirmedActionButton
                      action={deleteTopicAction.bind(
                        null,
                        platformSlug,
                        bot.id,
                        topic.id,
                      )}
                      confirmTitle="حذف یا غیرفعال‌سازی موضوع؟"
                      confirmDescription="اگر موضوع استفاده شده باشد، برای حفظ تاریخچه غیرفعال می‌شود."
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 />
                      حذف
                    </ConfirmedActionButton>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <CircleUserRound className="dashboard-accent-text size-5" />
            مشترک‌ها
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            فقط کاربرانی نمایش داده می‌شوند که در گفت‌وگوی خصوصی با ربات تعامل کرده‌اند.
          </p>
        </div>
        <form className="dashboard-card grid gap-3 rounded-2xl p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={query.q}
              placeholder="نام، نام کاربری یا شناسه"
              className="pr-9"
            />
          </div>
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="ACTIVE">فعال</option>
            <option value="UNSUBSCRIBED">لغو عضویت</option>
            <option value="BLOCKED">مسدود</option>
          </select>
          <select
            name="topic"
            defaultValue={query.topic ?? ""}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">همه موضوع‌ها</option>
            {bot.notificationTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          <Button type="submit">اعمال فیلتر</Button>
        </form>

        {subscribers.length === 0 ? (
          <EmptyState text="مشترکی با این فیلتر پیدا نشد." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {subscribers.map((subscriber) => (
              <article
                key={subscriber.id}
                className="dashboard-card rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {[subscriber.firstName, subscriber.lastName]
                        .filter(Boolean)
                        .join(" ") || "کاربر بدون نام"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500" dir="ltr">
                      {subscriber.username
                        ? `@${subscriber.username}`
                        : subscriber.platformUserId}
                    </p>
                  </div>
                  <SubscriberStatusBadge status={subscriber.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {subscriber.subscriptions.length ? (
                    subscriber.subscriptions.map(({ topic }) => (
                      <span
                        key={topic.id}
                        className="dashboard-accent-surface rounded-full px-2.5 py-1 text-xs"
                      >
                        {topic.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">
                      بدون موضوع فعال
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-2">
                  <span>اولین مشاهده: {tehranDateTime.format(subscriber.firstSeenAt)}</span>
                  <span>
                    آخرین تعامل:{" "}
                    {subscriber.lastInteractionAt
                      ? tehranDateTime.format(subscriber.lastInteractionAt)
                      : "ثبت نشده"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline" disabled={page <= 1}>
              <Link href={`${path}?page=${Math.max(1, page - 1)}`}>قبلی</Link>
            </Button>
            <span className="px-3 py-2 text-sm text-slate-500">
              {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
            </span>
            <Button asChild variant="outline" disabled={page >= totalPages}>
              <Link href={`${path}?page=${Math.min(totalPages, page + 1)}`}>بعدی</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Clock3 className="dashboard-accent-text size-5" />
            آخرین ارسال‌های خصوصی
          </h2>
          </div>
          <form className="flex gap-2">
            <select
              name="dispatchStatus"
              defaultValue={query.dispatchStatus ?? ""}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="PENDING">در انتظار</option>
              <option value="SENT">ارسال‌شده</option>
              <option value="FAILED">ناموفق</option>
              <option value="SKIPPED">ردشده</option>
              <option value="BLOCKED">مسدود</option>
            </select>
            <Button type="submit" variant="outline">فیلتر</Button>
          </form>
        </div>
        {dispatches.length === 0 ? (
          <EmptyState text="هنوز ارسال خصوصی ثبت نشده است." />
        ) : (
          <div className="dashboard-card overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="p-3">مشترک</th>
                    <th className="p-3">کمپین</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3">تلاش‌ها</th>
                    <th className="p-3">زمان</th>
                    <th className="p-3">خطا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatches.map((dispatch) => (
                    <tr key={dispatch.id}>
                      <td className="p-3">
                        {dispatch.subscriber.username
                          ? `@${dispatch.subscriber.username}`
                          : dispatch.subscriber.firstName ||
                            dispatch.subscriber.platformUserId}
                      </td>
                      <td className="p-3">{dispatch.campaign?.chatTitle ?? "ارسال دستی"}</td>
                      <td className="p-3">{dispatch.status}</td>
                      <td className="p-3">{dispatch.attemptCount.toLocaleString("fa-IR")}</td>
                      <td className="p-3">{tehranDateTime.format(dispatch.sentAt ?? dispatch.createdAt)}</td>
                      <td className="max-w-64 truncate p-3 text-xs text-red-600">
                        {dispatch.errorLog ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {dispatchTotalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link
                href={`${path}?dpage=${Math.max(1, dispatchPage - 1)}${
                  dispatchStatus ? `&dispatchStatus=${dispatchStatus}` : ""
                }`}
              >
                قبلی
              </Link>
            </Button>
            <span className="px-3 py-2 text-sm text-slate-500">
              {dispatchPage.toLocaleString("fa-IR")} از{" "}
              {dispatchTotalPages.toLocaleString("fa-IR")}
            </span>
            <Button asChild variant="outline">
              <Link
                href={`${path}?dpage=${Math.min(
                  dispatchTotalPages,
                  dispatchPage + 1,
                )}${dispatchStatus ? `&dispatchStatus=${dispatchStatus}` : ""}`}
              >
                بعدی
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function SubscriberStatusBadge({
  status,
}: {
  status: "ACTIVE" | "UNSUBSCRIBED" | "BLOCKED";
}) {
  const labels = {
    ACTIVE: "فعال",
    UNSUBSCRIBED: "لغو عضویت",
    BLOCKED: "مسدود",
  };
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
      {labels[status]}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
      <Tags className="mx-auto mb-3 size-6" />
      {text}
    </div>
  );
}
