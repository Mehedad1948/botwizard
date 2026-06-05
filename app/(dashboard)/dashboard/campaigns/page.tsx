// src/app/dashboard/campaigns/page.tsx
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { toggleCampaignAction, deleteCampaignAction } from "./actions";

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    where: { post: { bot: { userId: session.userId } } },
    include: { post: { include: { bot: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">مدیریت کمپین‌ها</h2>
        <p className="text-muted-foreground text-sm">
          وضعیت ارسال‌های زمان‌بندی شده خود را در این بخش مشاهده و مدیریت کنید.
        </p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            هیچ کمپینی یافت نشد. می‌توانید از طریق ربات تلگرام یا بخش پست‌ها یک کمپین بسازید.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-right">
                <tr>
                  <th className="px-4 py-3 font-medium">پست / ربات</th>
                  <th className="px-4 py-3 font-medium">گروه (Chat ID)</th>
                  <th className="px-4 py-3 font-medium text-center">بازه (ساعت)</th>
                  <th className="px-4 py-3 font-medium text-center">وضعیت</th>
                  <th className="px-4 py-3 font-medium text-center">اجرای بعدی</th>
                  <th className="px-4 py-3 font-medium text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y text-right">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold truncate max-w-[150px]">{camp.post.content || "مدیا"}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">@{camp.post.bot.username}</p>
                    </td>
                    <td className="px-4 py-3 font-mono" dir="ltr">{camp.chatId}</td>
                    <td className="px-4 py-3 text-center">{camp.intervalHours}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${camp.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                        {camp.isActive ? "فعال" : "متوقف"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs" dir="ltr">
                      {new Date(camp.nextRun).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <form action={toggleCampaignAction.bind(null, camp.id, camp.isActive)}>
                          <button type="submit" className="text-xs px-2 py-1 rounded border hover:bg-secondary">
                            {camp.isActive ? "توقف" : "شروع"}
                          </button>
                        </form>
                        <form action={deleteCampaignAction.bind(null, camp.id)}>
                          <button type="submit" className="text-xs px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10">
                            حذف
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
