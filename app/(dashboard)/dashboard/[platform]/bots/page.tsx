import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { BotCard } from "./BotCard";
import { AddBotPanel } from "./AddBotPanel";
import {
  platformConfigs,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

export default async function BotsPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  const { platform } = await params;
  const platformSlug = requirePlatformSlug(platform);
  const platformValue = platformFromSlug(platformSlug);
  const platformConfig = platformConfigs[platformSlug];

  // دریافت ربات‌ها به همراه تعداد گروه‌ها، کمپین‌ها و پست‌ها
  const bots = await prisma.bot.findMany({
    where: { userId: session.userId, platform: platformValue },
    include: {
      _count: {
        select: { connectedChats: true, campaigns: true, posts: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">مدیریت ربات‌ها</h2>
        <p className="text-muted-foreground text-sm">
          در این بخش می‌توانید ربات‌های {platformConfig.labelFa} خود را برای
          ارسال پست اضافه یا مدیریت کنید.
        </p>
      </div>

      <AddBotPanel platform={platformSlug} />

      {/* Bots List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">ربات‌های متصل شده</h3>
        {bots.length === 0 ? (
          <div className="dashboard-accent-surface rounded-2xl border border-dashed p-8 text-center">
            هیچ رباتی هنوز اضافه نشده است.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} platform={platformSlug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
