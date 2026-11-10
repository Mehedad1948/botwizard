import type { CampaignStatus } from "@prisma/client";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";

import { CampaignCard, campaignCardInclude } from "@/components/dashboard/CampaignCard";
import { EmptyState, PageHeader } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";
import { faNumber } from "@/services/publishing/format";

const FILTERS: { value: CampaignStatus; label: string }[] = [
  { value: "ACTIVE", label: "فعال" },
  { value: "PAUSED", label: "متوقف" },
  { value: "COMPLETED", label: "پایان‌یافته" },
];

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const userId = await requirePageUser();
  const { platform } = await params;
  const { status } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const owner = { userId, platform: platformFromSlug(platformSlug) };

  const counts = await prisma.campaign.groupBy({
    by: ["status"],
    where: { bot: owner },
    _count: true,
  });
  const countOf = (value: CampaignStatus) =>
    counts.find((row) => row.status === value)?._count ?? 0;
  const total = counts.reduce((sum, row) => sum + row._count, 0);
  const filter =
    FILTERS.find((item) => item.value === status)?.value ??
    (countOf("ACTIVE") ? "ACTIVE" : countOf("PAUSED") ? "PAUSED" : "COMPLETED");

  const campaigns = await prisma.campaign.findMany({
    where: { bot: owner, status: filter },
    include: campaignCardInclude,
    orderBy: filter === "ACTIVE" ? { nextRun: "asc" } : { updatedAt: "desc" },
    take: 60,
  });
  const basePath = dashboardPath(platformSlug, "campaigns");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="کمپین‌ها"
        description="ارسال‌های فوری و زمان‌بندی‌شده به کانال‌ها و گروه‌ها"
        actions={
          <Button asChild>
            <Link href={dashboardPath(platformSlug, "campaigns/new")}>
              <CalendarPlus />
              ارسال یا زمان‌بندی جدید
            </Link>
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          title="هنوز کمپینی ندارید"
          action={
            <Button asChild>
              <Link href={dashboardPath(platformSlug, "campaigns/new")}>اولین کمپین را بسازید</Link>
            </Button>
          }
        >
          یک پست را یک‌بار یا به‌صورت تکراری به چند کانال و گروه بفرستید. می‌توانید محتوا را مستقیم برای ربات هم بفرستید.
        </EmptyState>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={`${basePath}?status=${item.value}`}
                aria-current={filter === item.value ? "page" : undefined}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-bold transition",
                  filter === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {item.label} ({faNumber(countOf(item.value))})
              </Link>
            ))}
          </nav>

          {campaigns.length === 0 ? (
            <EmptyState title="کمپینی با این وضعیت وجود ندارد" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} platform={platformSlug} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
