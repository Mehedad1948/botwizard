import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
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
  Send,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateCampaignForm } from "../../posts/CreateCampaignForm";
import { toggleCampaignAction } from "../actions";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const { campaignId } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      bot: { userId: session.userId },
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
        },
      },
      post: true,
      history: {
        orderBy: { sentAt: "desc" },
        take: 8,
      },
      _count: { select: { history: true } },
    },
  });

  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link href="/dashboard/campaigns">
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
          action={toggleCampaignAction.bind(null, campaign.id)}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <article className="dashboard-card space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-sky-700">پست مرتبط</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">
                محتوای انتخاب‌شده برای این کمپین
              </h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
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

          <div className="min-h-36 rounded-2xl border border-sky-100 bg-sky-50/55 p-4">
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
            postId={campaign.post.id}
            destinations={campaign.bot.connectedChats}
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
              <Link href={`/dashboard/bots/${campaign.bot.id}`}>
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
      <div className="flex items-center gap-2 text-sky-700 [&_svg]:size-4">
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
