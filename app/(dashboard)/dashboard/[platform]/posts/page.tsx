import { Archive, ArchiveRestore, CalendarPlus, Eye, FilePlus2, Pencil } from "lucide-react";
import Link from "next/link";

import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
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
import { MEDIA_TYPE_LABELS, postPreviewText } from "@/services/publishing/content";
import { faNumber, formatDateTime } from "@/services/publishing/format";
import { previewPostAction, setPostArchivedAction } from "./actions";

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ botId?: string; archived?: string }>;
}) {
  const userId = await requirePageUser();
  const { platform } = await params;
  const { botId, archived } = await searchParams;
  const platformSlug = requirePlatformSlug(platform);
  const showArchived = archived === "1";

  const bots = await prisma.bot.findMany({
    where: { userId, platform: platformFromSlug(platformSlug) },
    select: { id: true, username: true },
    orderBy: { createdAt: "desc" },
  });
  const botFilter = bots.some((bot) => bot.id === botId) ? botId : undefined;
  const posts = await prisma.post.findMany({
    where: {
      bot: { userId, platform: platformFromSlug(platformSlug) },
      ...(botFilter ? { botId: botFilter } : {}),
      archivedAt: showArchived ? { not: null } : null,
    },
    include: {
      bot: { select: { username: true } },
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const href = (next: { botId?: string; archived?: boolean }) => {
    const query = new URLSearchParams();
    if (next.botId) query.set("botId", next.botId);
    if (next.archived) query.set("archived", "1");
    const value = query.toString();
    return `${dashboardPath(platformSlug, "posts")}${value ? `?${value}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="پست‌ها"
        description="محتوای آماده انتشار. پست‌هایی که برای ربات می‌فرستید هم اینجا ذخیره می‌شوند."
        actions={
          <Button asChild>
            <Link href={`${dashboardPath(platformSlug, "posts/new")}${botFilter ? `?botId=${botFilter}` : ""}`}>
              <FilePlus2 />
              پست جدید
            </Link>
          </Button>
        }
      />

      <nav className="flex flex-wrap gap-2 text-sm font-bold">
        {bots.length > 1 && (
          <>
            <FilterLink href={href({ archived: showArchived })} active={!botFilter}>
              همه ربات‌ها
            </FilterLink>
            {bots.map((bot) => (
              <FilterLink
                key={bot.id}
                href={href({ botId: bot.id, archived: showArchived })}
                active={botFilter === bot.id}
              >
                <span dir="ltr">@{bot.username}</span>
              </FilterLink>
            ))}
            <span className="mx-1 w-px bg-slate-200" />
          </>
        )}
        <FilterLink href={href({ botId: botFilter })} active={!showArchived}>
          فعال
        </FilterLink>
        <FilterLink href={href({ botId: botFilter, archived: true })} active={showArchived}>
          بایگانی
        </FilterLink>
      </nav>

      {posts.length === 0 ? (
        <EmptyState
          title={showArchived ? "پست بایگانی‌شده‌ای ندارید" : "هنوز پستی ندارید"}
          action={
            !showArchived && bots.length > 0 ? (
              <Button asChild>
                <Link href={dashboardPath(platformSlug, "posts/new")}>ساخت اولین پست</Link>
              </Button>
            ) : undefined
          }
        >
          {!showArchived &&
            "پست را اینجا بنویسید، یا متن و عکس را مستقیم برای ربات خود بفرستید."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="dashboard-card flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">
                  {MEDIA_TYPE_LABELS[post.mediaType]}
                </span>
                <span>{formatDateTime(post.createdAt, "Asia/Tehran")}</span>
              </div>
              {post.title && <h3 className="font-black text-slate-900">{post.title}</h3>}
              <p className="line-clamp-5 flex-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {postPreviewText(post, 400)}
              </p>
              <p className="text-xs text-slate-400">
                <span dir="ltr">@{post.bot.username}</span> ·{" "}
                {faNumber(post._count.campaigns)} کمپین
              </p>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {!showArchived && (
                  <Button asChild size="sm">
                    <Link
                      href={`${dashboardPath(platformSlug, "campaigns/new")}?botId=${post.botId}&postId=${post.id}`}
                    >
                      <CalendarPlus />
                      ارسال / زمان‌بندی
                    </Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={dashboardPath(platformSlug, `posts/${post.id}`)}>
                    <Pencil />
                    ویرایش
                  </Link>
                </Button>
                <ConfirmedActionButton
                  action={previewPostAction.bind(null, platformSlug, post.botId, post.id)}
                  pendingLabel="در حال ارسال…"
                  ariaLabel="ارسال پیش‌نمایش برای من در ربات"
                >
                  <Eye />
                  پیش‌نمایش در ربات
                </ConfirmedActionButton>
                <ConfirmedActionButton
                  action={setPostArchivedAction.bind(
                    null,
                    platformSlug,
                    post.botId,
                    post.id,
                    !showArchived,
                  )}
                  confirmTitle={showArchived ? undefined : "بایگانی پست؟"}
                  confirmDescription={
                    showArchived
                      ? undefined
                      : "کمپین‌های فعال این پست متوقف می‌شوند. بعداً می‌توانید آن را بازگردانید."
                  }
                  pendingLabel="…"
                  variant="ghost"
                >
                  {showArchived ? <ArchiveRestore /> : <Archive />}
                  {showArchived ? "بازگردانی" : "بایگانی"}
                </ConfirmedActionButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-xl border px-3 py-2 transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}
