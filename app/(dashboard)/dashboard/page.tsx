// src/app/dashboard/page.tsx
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">خلاصه وضعیت</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">ربات‌های متصل</h3>
          <p className="text-3xl font-bold mt-2">{botsCount}</p>
        </div>
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">کمپین‌های فعال</h3>
          <p className="text-3xl font-bold mt-2 text-green-600">{activeCampaignsCount}</p>
        </div>
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">محتوای ذخیره شده</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{postsCount}</p>
        </div>
      </div>
    </div>
  );
}
