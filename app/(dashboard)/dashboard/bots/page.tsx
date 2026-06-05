// src/app/dashboard/bots/page.tsx
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { addBotAction, deleteBotAction } from "./actions";

export default async function BotsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  // Fetch user's bots
  const bots = await prisma.bot.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">مدیریت ربات‌ها</h2>
        <p className="text-muted-foreground text-sm">
          در این بخش می‌توانید ربات‌های تلگرامی خود را برای ارسال پست اضافه یا مدیریت کنید.
        </p>
      </div>

      {/* Guide Section */}
      <div className="p-5 rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 text-sm leading-relaxed">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 text-base">
          راهنمای دریافت توکن ربات (Bot Token)
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-900/80 dark:text-blue-200/80">
          <li>
            در تلگرام عبارت{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              dir="ltr"
            >
              @BotFather
            </a>{" "}
            را جستجو کرده و وارد آن شوید.
          </li>
          <li>
            دکمه <strong>Start</strong> را بزنید یا دستور <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded" dir="ltr">/newbot</code> را ارسال کنید.
          </li>
          <li>یک <strong>نام دلخواه</strong> برای ربات خود وارد کنید (مثلاً: ربات فروشگاه من).</li>
          <li>
            یک <strong>نام کاربری (Username)</strong> انگلیسی برای ربات بفرستید که حتماً باید با کلمه <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">bot</code> تمام شود (مثلاً: <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded" dir="ltr">my_shop_bot</code>).
          </li>
          <li>
            در پیام موفقیت‌آمیز بات‌فادر، یک متن قرمز رنگ یا متمایز وجود دارد که همان <strong>توکن ربات</strong> شماست (مشابه کادر زیر). آن را کپی کرده و اینجا وارد کنید.
          </li>
        </ol>
      </div>

      {/* Add Bot Form */}
      <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <form action={addBotAction} className="flex gap-4 items-end flex-wrap sm:flex-nowrap">
          <div className="flex-1 space-y-2 w-full">
            <label htmlFor="token" className="text-sm font-medium">
              توکن ربات
            </label>
            <input
              type="text"
              id="token"
              name="token"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="ltr"
              required
            />
          </div>
          <button
            type="submit"
            className="h-10 px-6 py-2 w-full sm:w-auto bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
          >
            افزودن ربات
          </button>
        </form>
      </div>

      {/* Bots List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">ربات‌های متصل شده</h3>
        {bots.length === 0 ? (
          <div className="p-8 text-center border rounded-xl border-dashed text-muted-foreground">
            هیچ رباتی هنوز اضافه نشده است.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bots.map((bot) => (
               <div key={bot.id} className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:shadow transition-shadow">
                 <div>
                   <p className="font-semibold text-lg" dir="ltr">@{bot.username}</p>
                   <p className="text-xs font-medium mt-1 text-green-600 dark:text-green-400 flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     {bot.isActive ? "فعال و متصل" : "غیرفعال"}
                   </p>
                 </div>
                 <form action={deleteBotAction.bind(null, bot.id)}>
                   <button 
                     type="submit" 
                     className="text-sm text-destructive hover:bg-destructive/10 px-3 py-2 rounded-md transition-colors font-medium"
                   >
                     حذف ربات
                   </button>
                 </form>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
