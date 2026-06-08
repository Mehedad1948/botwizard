import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  Bot,
  ExternalLink,
  FileText,
  ImageIcon,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateCampaignForm } from "./CreateCampaignForm";
import { deletePostAction } from "./actions";

const tehranDateTime = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function PostsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const bots = await prisma.bot.findMany({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (bots.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold">ابتدا یک ربات اضافه کنید</h1>
        <p className="text-sm text-muted-foreground">
          برای دریافت و مدیریت محتوا، حداقل یک ربات باید به سامانه متصل باشد.
        </p>
        <Button asChild>
          <Link href="/dashboard/bots">مدیریت ربات‌ها</Link>
        </Button>
      </div>
    );
  }

  const posts = await prisma.post.findMany({
    where: { bot: { userId: session.userId } },
    include: {
      bot: {
        select: {
          id: true,
          username: true,
          connectedChats: {
            select: { id: true, chatTitle: true },
            orderBy: { chatTitle: "asc" },
          },
        },
      },
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">محتوا و پست‌ها</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          پست‌های دریافت‌شده از ربات‌ها را مشاهده کنید و برای مقصدهای متصل
          کمپین بسازید.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          هنوز پستی ثبت نشده است. محتوای خود را در گفت‌وگوی خصوصی یکی از
          ربات‌ها ارسال کنید.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold" dir="ltr">
                    <Bot className="size-4" />@{post.bot.username}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tehranDateTime.format(post.createdAt)}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                  {post.mediaType === "IMAGE" ? (
                    <ImageIcon className="size-3.5" />
                  ) : post.mediaType === "VIDEO" ? (
                    <Video className="size-3.5" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                  {post.mediaType === "NONE" ? "متن" : post.mediaType}
                </span>
              </div>

              <div className="min-h-28 rounded-xl bg-muted/50 p-4">
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {post.content || "محتوای رسانه‌ای بدون متن"}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {post._count.campaigns.toLocaleString("fa-IR")} کمپین وابسته
                </span>
                <span>
                  {post.sourceMessageId
                    ? "ثبت‌شده از تلگرام"
                    : "ثبت‌شده از داشبورد"}
                </span>
              </div>

              <CreateCampaignForm
                postId={post.id}
                destinations={post.bot.connectedChats}
              />

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/bots/${post.bot.id}#posts`}>
                    <ExternalLink />
                    جزئیات ربات
                  </Link>
                </Button>
                <ConfirmedActionButton
                  action={deletePostAction.bind(null, post.id)}
                  confirmTitle="حذف دائمی پست؟"
                  confirmDescription={`این پست و ${post._count.campaigns.toLocaleString("fa-IR")} کمپین وابسته برای همیشه حذف می‌شوند.`}
                  pendingLabel="در حال حذف..."
                  variant="destructive"
                >
                  <Trash2 />
                  حذف پست
                </ConfirmedActionButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
