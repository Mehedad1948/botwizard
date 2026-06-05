import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createPostAction, deletePostAction } from "./actions";
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
        <p className="text-muted-foreground text-sm">
          پست‌های خود را برای ربات‌های مختلف ایجاد کنید تا در کمپین‌ها زمان‌بندی شوند.
        </p>
      </div>

      {/* فرم ایجاد پست */}
      <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <h3 className="text-lg font-semibold mb-4">ایجاد پست جدید</h3>
        <form action={createPostAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="botId" className="text-sm font-medium">انتخاب ربات (فرستنده)</label>
              <select
                id="botId"
                name="botId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">انتخاب کنید...</option>
                {bots.map(bot => (
                  <option key={bot.id} value={bot.id}>@{bot.username}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="mediaType" className="text-sm font-medium">نوع محتوا</label>
              <select
                id="mediaType"
                name="mediaType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="NONE">فقط متن</option>
                <option value="PHOTO">عکس + متن (کپشن)</option>
                <option value="VIDEO">ویدیو + متن (کپشن)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="mediaUrl" className="text-sm font-medium">لینک مدیا (اختیاری)</label>
            <input
              type="url"
              id="mediaUrl"
              name="mediaUrl"
              placeholder="https://example.com/image.jpg"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">محتوای پیام</label>
            <textarea
              id="content"
              name="content"
              rows={4}
              placeholder="متن پیام خود را اینجا بنویسید..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="h-10 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              ذخیره پست
            </button>
          </div>
        </form>
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
                    <button 
                      type="submit" 
                      className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors font-medium"
                    >
                      حذف
                    </button>
                  </form>
                </div>
                
                <div className="flex-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {post.content || <span className="italic text-muted-foreground/50">بدون متن...</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
