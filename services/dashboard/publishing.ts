import prisma from "@/lib/prisma";
import type { CampaignFormDestination, CampaignFormPost } from "@/components/publishing/CampaignForm";
import { MEDIA_TYPE_LABELS, postPreviewText } from "@/services/publishing/content";
import { CHAT_TYPE_LABELS } from "@/services/publishing/destinations";
import { formatDateTime } from "@/services/publishing/format";

/** Posts and destinations a campaign form for `botId` can choose from. */
export async function loadCampaignFormData(botId: string, includePostId?: string) {
  const [posts, destinations, topicCount] = await Promise.all([
    prisma.post.findMany({
      where: {
        botId,
        OR: [{ archivedAt: null }, ...(includePostId ? [{ id: includePostId }] : [])],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, content: true, mediaType: true, createdAt: true },
    }),
    prisma.connectedChat.findMany({
      where: { botId, status: { not: "REMOVED" } },
      orderBy: [{ status: "asc" }, { chatTitle: "asc" }],
    }),
    prisma.notificationTopic.count({ where: { botId, isActive: true } }),
  ]);

  return {
    posts: posts.map(
      (post): CampaignFormPost => ({
        id: post.id,
        label: post.title ? `${post.title} — ${postPreviewText(post, 80)}` : postPreviewText(post, 140),
        kind: `${MEDIA_TYPE_LABELS[post.mediaType]} · ${formatDateTime(post.createdAt, "Asia/Tehran")}`,
      }),
    ),
    destinations: destinations.map(
      (destination): CampaignFormDestination => ({
        id: destination.id,
        title: destination.chatTitle,
        typeLabel: CHAT_TYPE_LABELS[destination.chatType],
        status: destination.status,
      }),
    ),
    hasTopics: topicCount > 0,
  };
}
