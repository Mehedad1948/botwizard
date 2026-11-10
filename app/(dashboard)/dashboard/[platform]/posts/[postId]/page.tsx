import Link from "next/link";
import { notFound } from "next/navigation";

import { PostComposer } from "@/components/publishing/PostComposer";
import { CampaignStatusBadge, PageHeader, Panel } from "@/components/publishing/ui";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  dashboardPath,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";
import { requirePageUser } from "@/services/dashboard/access";
import { buttonsToLines, MEDIA_TYPE_LABELS } from "@/services/publishing/content";
import { describeSchedule } from "@/services/publishing/format";
import { updatePostTopicsAction } from "../../bots/[botId]/notifications/actions";

export default async function PostPage({
  params,
}: {
  params: Promise<{ platform: string; postId: string }>;
}) {
  const userId = await requirePageUser();
  const { platform, postId } = await params;
  const platformSlug = requirePlatformSlug(platform);
  const post = await prisma.post.findFirst({
    where: { id: postId, bot: { userId, platform: platformFromSlug(platformSlug) } },
    include: {
      bot: {
        select: {
          id: true,
          username: true,
          notificationTopics: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, name: true },
          },
        },
      },
      notificationTopics: { select: { topicId: true } },
      campaigns: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!post) notFound();

  const assigned = new Set(post.notificationTopics.map((item) => item.topicId));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={post.title || "ویرایش پست"}
        description={
          <span>
            {MEDIA_TYPE_LABELS[post.mediaType]} · <span dir="ltr">@{post.bot.username}</span>
            {post.archivedAt && " · بایگانی‌شده"}
          </span>
        }
        back={{ href: dashboardPath(platformSlug, "posts"), label: "پست‌ها" }}
        actions={
          <Button asChild>
            <Link
              href={`${dashboardPath(platformSlug, "campaigns/new")}?botId=${post.botId}&postId=${post.id}`}
            >
              ارسال / زمان‌بندی
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <PostComposer
          platform={platformSlug}
          bots={[{ id: post.bot.id, username: post.bot.username, canUpload: false }]}
          post={{
            id: post.id,
            botId: post.botId,
            title: post.title ?? "",
            content: post.content ?? "",
            buttons: buttonsToLines(post.buttons),
            hasMedia: post.mediaType !== "NONE",
            hasFormatting: Array.isArray(post.entities) && post.entities.length > 0,
          }}
        />

        <aside className="space-y-6">
          <Panel title="کمپین‌های این پست">
            {post.campaigns.length === 0 ? (
              <p className="text-sm text-slate-500">هنوز در کمپینی استفاده نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {post.campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      href={dashboardPath(platformSlug, `campaigns/${campaign.id}`)}
                      className="block space-y-1 text-sm hover:underline"
                    >
                      <CampaignStatusBadge status={campaign.status} />
                      <span className="block text-slate-700">
                        {campaign.name || describeSchedule(campaign)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {post.bot.notificationTopics.length > 0 && (
            <Panel
              title="موضوع‌های اعلان"
              description="اگر اعلان در کمپین فعال باشد، مشترک‌های این موضوع‌ها نسخه خصوصی پست را می‌گیرند."
            >
              <form
                action={async (formData) => {
                  "use server";
                  await updatePostTopicsAction(platformSlug, post.botId, post.id, formData);
                }}
                className="space-y-3"
              >
                <div className="flex flex-wrap gap-2">
                  {post.bot.notificationTopics.map((topic) => (
                    <label
                      key={topic.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="topicId"
                        value={topic.id}
                        defaultChecked={assigned.has(topic.id)}
                      />
                      {topic.name}
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" variant="outline">
                  ذخیره موضوع‌ها
                </Button>
              </form>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
