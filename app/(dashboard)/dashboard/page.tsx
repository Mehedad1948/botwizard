import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Bot, CalendarClock, FileText, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

const metrics = [
  {
    key: "bots",
    label: "ربات‌های متصل",
    description: "ربات‌های ثبت‌شده در حساب شما",
    icon: Bot,
    value: 0,
  },
  {
    key: "campaigns",
    label: "کمپین‌های فعال",
    description: "ارسال‌های فعال و زمان‌بندی‌شده",
    icon: CalendarClock,
    value: 0,
  },
  {
    key: "posts",
    label: "محتوای ذخیره‌شده",
    description: "پست‌های آماده استفاده در کمپین‌ها",
    icon: FileText,
    value: 0,
  },
] as const;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const [botsCount, activeCampaignsCount, postsCount] = await Promise.all([
    prisma.bot.count({ where: { userId: session.userId } }),
    prisma.campaign.count({
      where: {
        isActive: true,
        post: { bot: { userId: session.userId } },
      },
    }),
    prisma.post.count({
      where: { bot: { userId: session.userId } },
    }),
  ]);

  const values = {
    bots: botsCount,
    campaigns: activeCampaignsCount,
    posts: postsCount,
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            خلاصه وضعیت
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            نمای سریع از فعالیت ربات‌ها، محتوا و کمپین‌های شما
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ key, label, description, icon: Icon }) => (
          <Card
            key={key}
            className="dashboard-card gap-0 rounded-2xl py-0"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-600">{label}</p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {values[key].toLocaleString("fa-IR")}
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
