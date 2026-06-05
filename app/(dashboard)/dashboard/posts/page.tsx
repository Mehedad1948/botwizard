import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createCampaignFromDashboardAction, createPostAction, deletePostAction } from "./actions";
import Link from "next/link";

export default async function PostsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  // دریافت ربات‌های کاربر برای لیست کشویی
  const bots = await prisma.bot.findMany({
    where: { userId: session.userId },
    select: { id: true, username: true },
  });

  // دریافت پست‌ها (با استفاده از ارتباط ربات به کاربر)
  const posts = await prisma.post.findMany({
    where: { bot: { userId: session.userId } },
    include: { bot: true },
    orderBy: { createdAt: "desc" },
  });
  console.log('✅✅✅', posts);


  if (bots.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 space-y-4">
        <h2 className="text-2xl font-bold">ابتدا یک ربات اضافه کنید</h2>
        <p className="text-muted-foreground">برای ایجاد محتوا، باید حداقل یک ربات در سیستم ثبت کرده باشید.</p>
        <Link href="/dashboard/bots" className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md">
          مدیریت ربات‌ها
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">محتوا و پست‌ها</h2>

      </div>

      {/* لیست پست‌ها */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">پست‌های ذخیره شده</h3>
        {posts.length === 0 ? (
          <div className="p-8 text-center border rounded-xl border-dashed text-muted-foreground">
            هیچ پستی هنوز ایجاد نشده است.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div key={post.id} className="flex flex-col p-4 border rounded-xl bg-card shadow-sm hover:shadow transition-shadow space-y-3">
                <div className="flex items-start justify-between border-b pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-primary dir-ltr">@{post.bot.username}</h4>
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground mt-1">
                      {post.mediaType === "NONE" ? "متن" : post.mediaType}
                    </span>
                  </div>
                  <form action={deletePostAction.bind(null, post.id)}>
                    <button type="submit" className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors font-medium">
                      حذف
                    </button>
                  </form>
                </div>

                <div className="flex-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {post.content || <span className="italic text-muted-foreground/50">بدون متن...</span>}
                </div>

                {/* فرم ساخت کمپین سریع */}
                <div className="pt-3 border-t mt-2">
                  <form action={createCampaignFromDashboardAction} className="flex flex-col gap-2">
                    <input type="hidden" name="postId" value={post.id} />
                    <div className="flex gap-2 text-xs">
                      <input
                        type="text"
                        name="chatId"
                        placeholder="Chat ID (مثل -100123...)"
                        className="flex-1 rounded border px-2 py-1 bg-background"
                        required
                        dir="ltr"
                      />
                      <input
                        type="number"
                        name="intervalHours"
                        placeholder="تکرار (ساعت)"
                        className="w-24 rounded border px-2 py-1 bg-background"
                        required
                        min="1"
                      />
                    </div>
                    <button type="submit" className="w-full bg-secondary text-secondary-foreground text-xs py-1.5 rounded hover:bg-secondary/80">
                      + ایجاد کمپین از این پست
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
