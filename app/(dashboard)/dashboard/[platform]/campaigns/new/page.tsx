import Link from "next/link";

import { CampaignForm } from "@/components/publishing/CampaignForm";
import { EmptyState, PageHeader } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";
import { loadCampaignFormData } from "@/services/dashboard/publishing";

export default async function NewCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ botId?: string; postId?: string }>;
}) {
  const userId = await requirePageUser();
  const { platform } = await params;
  const { botId, postId } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);

  const bots = await prisma.bot.findMany({
    where: { userId, platform: platformFromSlug(platformSlug) },
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true },
  });
  const bot = bots.find((item) => item.id === botId) ?? (bots.length === 1 ? bots[0] : null);
  const back = { href: dashboardPath(platformSlug, "campaigns"), label: "کمپین‌ها" };

  if (!bots.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="ارسال یا زمان‌بندی" back={back} />
        <EmptyState
          title="ابتدا یک ربات اضافه کنید"
          action={
            <Button asChild>
              <Link href={dashboardPath(platformSlug, "bots")}>افزودن ربات</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="ارسال یا زمان‌بندی" description="با کدام ربات ارسال شود؟" back={back} />
        <div className="grid gap-3 sm:grid-cols-2">
          {bots.map((item) => (
            <Link
              key={item.id}
              href={`${dashboardPath(platformSlug, "campaigns/new")}?botId=${item.id}`}
              className="dashboard-card rounded-2xl p-5 font-bold transition hover:-translate-y-0.5"
              dir="ltr"
            >
              @{item.username}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const data = await loadCampaignFormData(bot.id, postId);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="ارسال یا زمان‌بندی"
        description={<span>ربات <span dir="ltr">@{bot.username}</span></span>}
        back={back}
      />
      <CampaignForm
        platform={platformSlug}
        botId={bot.id}
        defaultPostId={data.posts.some((post) => post.id === postId) ? postId : undefined}
        {...data}
      />
    </div>
  );
}
