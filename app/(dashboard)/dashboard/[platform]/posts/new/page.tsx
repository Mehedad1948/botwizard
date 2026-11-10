import Link from "next/link";

import { PostComposer } from "@/components/publishing/PostComposer";
import { EmptyState, PageHeader } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";

export default async function NewPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ botId?: string }>;
}) {
  const userId = await requirePageUser();
  const { platform } = await params;
  const { botId } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const bots = await prisma.bot.findMany({
    where: { userId, platform: platformFromSlug(platformSlug) },
    select: { id: true, username: true, ownerPlatformUserId: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="پست جدید"
        description="پست یک‌بار ساخته می‌شود و می‌توانید آن را در چند کمپین استفاده کنید."
        back={{ href: dashboardPath(platformSlug, "posts"), label: "پست‌ها" }}
      />
      {bots.length === 0 ? (
        <EmptyState
          title="ابتدا یک ربات اضافه کنید"
          action={
            <Button asChild>
              <Link href={dashboardPath(platformSlug, "bots")}>افزودن ربات</Link>
            </Button>
          }
        />
      ) : (
        <PostComposer
          platform={platformSlug}
          defaultBotId={bots.some((bot) => bot.id === botId) ? botId : undefined}
          bots={bots.map((bot) => ({
            id: bot.id,
            username: bot.username,
            canUpload: Boolean(bot.ownerPlatformUserId),
          }))}
        />
      )}
    </div>
  );
}
