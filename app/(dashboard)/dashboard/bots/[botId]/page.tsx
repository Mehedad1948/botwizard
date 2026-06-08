import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock3,
  ExternalLink,
  FileText,
  MessageSquare,
  Pause,
  Play,
  Power,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteCampaignAction,
  deletePostAction,
  leaveConnectedChatAction,
  toggleBotStatusAction,
  toggleCampaignStatusAction,
} from "./actions";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatSchedule(campaign: {
  scheduleType: "INTERVAL" | "SPECIFIC_TIMES";
  intervalHours: number | null;
  specificTimes: string[];
}) {
  if (campaign.scheduleType === "SPECIFIC_TIMES") {
    return `روزانه در ${campaign.specificTimes.join("، ")}`;
  }

  return `هر ${campaign.intervalHours ?? "نامشخص"} ساعت`;
}

function contentPreview(content: string | null) {
  if (!content) return "محتوای رسانه‌ای بدون متن";
  return content.length > 140 ? `${content.slice(0, 140)}…` : content;
}

export default async function BotWorkspacePage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const { botId } = await params;
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId: session.userId },
    include: {
      connectedChats: {
        orderBy: { createdAt: "desc" },
      },
      posts: {
        include: {
          _count: { select: { campaigns: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      campaigns: {
        include: {
          post: {
            select: { id: true, content: true, mediaType: true },
          },
          history: {
            orderBy: { sentAt: "desc" },
            take: 5,
          },
          _count: { select: { history: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!bot) notFound();

  const activeCampaigns = bot.campaigns.filter(
    (campaign) => campaign.isActive
  ).length;
  const chatCampaignCounts = new Map<string, number>();

  for (const campaign of bot.campaigns) {
    chatCampaignCounts.set(
      campaign.chatId,
      (chatCampaignCounts.get(campaign.chatId) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/dashboard/bots"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            بازگشت به ربات‌ها
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Bot className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" dir="ltr">
                @{bot.username}
              </h1>
              <p className="text-sm text-muted-foreground">
                مرکز مدیریت محتوا، مقصدها و ارسال‌های این ربات
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a
              href={`https://t.me/${bot.username}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink />
              باز کردن در تلگرام
            </a>
          </Button>
          <ConfirmedActionButton
            action={toggleBotStatusAction.bind(null, bot.id)}
            pendingLabel="در حال تغییر..."
            variant={bot.isActive ? "outline" : "default"}
          >
            <Power />
            {bot.isActive ? "غیرفعال‌کردن ربات" : "فعال‌کردن ربات"}
          </ConfirmedActionButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Activity />}
          label="وضعیت ربات"
          value={bot.isActive ? "فعال" : "غیرفعال"}
          accent={bot.isActive ? "text-green-600" : "text-amber-600"}
        />
        <StatCard
          icon={<CalendarClock />}
          label="کمپین فعال"
          value={activeCampaigns.toLocaleString("fa-IR")}
        />
        <StatCard
          icon={<FileText />}
          label="پست ذخیره‌شده"
          value={bot.posts.length.toLocaleString("fa-IR")}
        />
        <StatCard
          icon={<Users />}
          label="مقصد متصل"
          value={bot.connectedChats.length.toLocaleString("fa-IR")}
        />
      </div>

      <section id="campaigns" className="space-y-4 scroll-mt-6">
        <SectionHeading
          icon={<CalendarClock />}
          title="کمپین‌ها"
          description="ارسال‌های زمان‌بندی‌شده را فعال، متوقف یا برای همیشه حذف کنید."
          count={bot.campaigns.length}
        />

        {bot.campaigns.length === 0 ? (
          <EmptyState text="هنوز کمپینی برای این ربات ثبت نشده است." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {bot.campaigns.map((campaign) => {
              const successCount = campaign.history.filter(
                (history) => history.status === "SUCCESS"
              ).length;
              const failedCount = campaign.history.filter(
                (history) => history.status === "FAILED"
              ).length;

              return (
                <article
                  key={campaign.id}
                  className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge active={campaign.isActive} />
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                          {formatSchedule(campaign)}
                        </span>
                      </div>
                      <h3 className="font-semibold">{campaign.chatTitle}</h3>
                      <p
                        className="mt-1 text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {campaign.chatId}
                      </p>
                    </div>
                    <CalendarClock className="size-5 text-muted-foreground" />
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      محتوای مرتبط
                    </p>
                    <p className="line-clamp-3 text-sm leading-6">
                      {contentPreview(campaign.post.content)}
                    </p>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <Clock3 className="size-4" />
                      اجرای بعدی: {tehranDateTime.format(campaign.nextRun)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MessageSquare className="size-4" />
                      تاریخچه: {campaign._count.history.toLocaleString("fa-IR")} ارسال
                    </p>
                    <p className="flex items-center gap-2 text-green-600">
                      <CircleCheck className="size-4" />
                      موفق در ۵ اجرای اخیر: {successCount.toLocaleString("fa-IR")}
                    </p>
                    <p className="flex items-center gap-2 text-red-600">
                      <CircleX className="size-4" />
                      ناموفق در ۵ اجرای اخیر: {failedCount.toLocaleString("fa-IR")}
                    </p>
                  </div>

                  {campaign.history[0]?.errorLog && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      آخرین خطا: {campaign.history[0].errorLog}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <ConfirmedActionButton
                      action={toggleCampaignStatusAction.bind(
                        null,
                        bot.id,
                        campaign.id
                      )}
                      pendingLabel="در حال تغییر..."
                    >
                      {campaign.isActive ? <Pause /> : <Play />}
                      {campaign.isActive ? "توقف کمپین" : "فعال‌سازی"}
                    </ConfirmedActionButton>
                    <ConfirmedActionButton
                      action={deleteCampaignAction.bind(
                        null,
                        bot.id,
                        campaign.id
                      )}
                      confirmTitle="حذف دائمی کمپین؟"
                      confirmDescription="این کمپین و تمام تاریخچه ارسال آن برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست."
                      pendingLabel="در حال حذف..."
                      variant="destructive"
                    >
                      <Trash2 />
                      حذف کمپین
                    </ConfirmedActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="posts" className="space-y-4 scroll-mt-6">
        <SectionHeading
          icon={<FileText />}
          title="پست‌های ذخیره‌شده"
          description="محتواهای دریافت‌شده از تلگرام و کمپین‌های وابسته را بررسی کنید."
          count={bot.posts.length}
        />

        {bot.posts.length === 0 ? (
          <EmptyState text="هنوز پستی از طریق این ربات دریافت نشده است." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bot.posts.map((post) => (
              <article
                key={post.id}
                className="flex min-h-64 flex-col rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {post.mediaType === "NONE" ? "متن" : post.mediaType}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {tehranDateTime.format(post.createdAt)}
                    </p>
                  </div>
                  <FileText className="size-5 text-muted-foreground" />
                </div>

                <p className="my-4 flex-1 whitespace-pre-wrap text-sm leading-7">
                  {contentPreview(post.content)}
                </p>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {post._count.campaigns.toLocaleString("fa-IR")} کمپین وابسته
                    </span>
                    <span>
                      {post.sourceMessageId ? "ثبت‌شده از تلگرام" : "ثبت‌شده از داشبورد"}
                    </span>
                  </div>
                  <ConfirmedActionButton
                    action={deletePostAction.bind(null, bot.id, post.id)}
                    confirmTitle="حذف دائمی پست؟"
                    confirmDescription={`با حذف این پست، ${post._count.campaigns.toLocaleString("fa-IR")} کمپین وابسته نیز برای همیشه حذف می‌شود.`}
                    pendingLabel="در حال حذف..."
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 />
                    حذف پست و کمپین‌های وابسته
                  </ConfirmedActionButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="destinations" className="space-y-4 scroll-mt-6">
        <SectionHeading
          icon={<Users />}
          title="گروه‌ها و کانال‌های متصل"
          description="مقصدهایی که ربات در آن‌ها عضو یا مدیر است."
          count={bot.connectedChats.length}
        />

        {bot.connectedChats.length === 0 ? (
          <EmptyState text="این ربات هنوز به هیچ گروه یا کانالی متصل نشده است." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bot.connectedChats.map((chat) => {
              const campaignCount = chatCampaignCounts.get(chat.chatId) ?? 0;

              return (
                <article
                  key={chat.id}
                  className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{chat.chatTitle}</h3>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {chat.chatId}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {campaignCount.toLocaleString("fa-IR")} کمپین مرتبط
                    </p>
                  </div>
                  <ConfirmedActionButton
                    action={leaveConnectedChatAction.bind(
                      null,
                      bot.id,
                      chat.id
                    )}
                    confirmTitle="خروج ربات از این مقصد؟"
                    confirmDescription={`ربات از «${chat.chatTitle}» خارج می‌شود و ${campaignCount.toLocaleString("fa-IR")} کمپین مرتبط متوقف خواهد شد.`}
                    pendingLabel="در حال خروج..."
                    variant="destructive"
                  >
                    <Trash2 />
                    خروج ربات
                  </ConfirmedActionButton>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        <span className="[&_svg]:size-5">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-primary [&_svg]:size-5">{icon}</span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
        {count.toLocaleString("fa-IR")}
      </span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
    >
      {active ? "فعال" : "متوقف"}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
