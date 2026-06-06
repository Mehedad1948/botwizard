import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { addBotAction } from "./actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./SubmitButton";
import { BotCard } from "./BotCard";

export default async function BotsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  // دریافت ربات‌ها به همراه تعداد گروه‌ها، کمپین‌ها و پست‌ها
  const bots = await prisma.bot.findMany({
    where: { userId: session.userId },
    include: {
      _count: {
        select: { connectedChats: true, campaigns: true, posts: true },
      },
    },
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
          <li>در تلگرام عبارت <a href="https://t.me/BotFather" target="_blank" className="font-medium text-blue-600 hover:underline" dir="ltr">@BotFather</a> را جستجو کرده و وارد آن شوید.</li>
          <li>دستور <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded" dir="ltr">/newbot</code> را ارسال کنید.</li>
          <li>یک نام و سپس یک نام کاربری (Username) مختوم به <code className="bg-black/10 px-1.5 py-0.5 rounded">bot</code> بفرستید.</li>
          <li>توکن ربات (متن قرمز رنگ) را کپی کرده و در کادر زیر وارد کنید.</li>
        </ol>
      </div>

      {/* Add Bot Form */}
      <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <form action={addBotAction} className="flex gap-4 items-end flex-wrap sm:flex-nowrap">
          <div className="flex-1 space-y-2 w-full">
            <label htmlFor="token" className="text-sm font-medium">توکن ربات</label>
            <Input
              type="text"
              id="token"
              name="token"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              dir="ltr"
              required
            />
          </div>
          <SubmitButton />
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
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
