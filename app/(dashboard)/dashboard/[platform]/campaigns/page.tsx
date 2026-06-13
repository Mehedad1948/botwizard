import { CampaignCard } from "@/components/dashboard/CampaignCard";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  dashboardPath,
  platformConfigs,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  const { platform } = await params;
  const { status } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const platformConfig = platformConfigs[platformSlug];

  const campaigns = await prisma.campaign.findMany({
    where: {
      bot: {
        userId: session.userId,
        platform: platformFromSlug(platformSlug),
      },
    },
    include: {
      bot: { select: { id: true, username: true, isActive: true } },
      _count: { select: { history: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.isActive,
  ).length;
  const inactiveCampaigns = campaigns.length - activeCampaigns;
  const statusFilter =
    status === "active" || status === "inactive" ? status : null;
  const filteredCampaigns = statusFilter
    ? campaigns.filter((campaign) =>
      statusFilter === "active" ? campaign.isActive : !campaign.isActive,
    )
    : campaigns;
  const campaignsPath = dashboardPath(platformSlug, "campaigns");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">مدیریت کمپین‌ها</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          همه ارسال‌های زمان‌بندی‌شده ربات‌های خود را در یک نمای یکپارچه مدیریت کنید.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          هنوز کمپینی ثبت نشده است. از داخل ربات {platformConfig.labelFa} یک زمان‌بندی ایجاد
          کنید.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
            <Link
              href={
                statusFilter === "active"
                  ? campaignsPath
                  : `${campaignsPath}?status=active`
              }
              aria-current={statusFilter === "active" ? "true" : undefined}
              className={`rounded-xl border px-3 py-2 text-emerald-700 transition-all ${statusFilter === "active"
                ? "border-emerald-400 bg-emerald-100 shadow-sm ring-2 ring-emerald-200"
                : "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100"
                }`}
            >
              {activeCampaigns.toLocaleString("fa-IR")} کمپین فعال
            </Link>
            <Link
              href={
                statusFilter === "inactive"
                  ? campaignsPath
                  : `${campaignsPath}?status=inactive`
              }
              aria-current={statusFilter === "inactive" ? "true" : undefined}
              className={`rounded-xl border px-3 py-2 text-slate-600 transition-all ${statusFilter === "inactive"
                ? "border-slate-400 bg-slate-200 shadow-sm ring-2 ring-slate-200"
                : "border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200"
                }`}
            >
              {inactiveCampaigns.toLocaleString("fa-IR")} کمپین متوقف
            </Link>
            {statusFilter && (
              <Link
                href={campaignsPath}
                className="px-2 py-2 text-xs font-bold text-slate-500 transition hover:text-slate-900"
              >
                نمایش همه
              </Link>
            )}
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
              کمپینی با این وضعیت وجود ندارد.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  platform={platformSlug}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
