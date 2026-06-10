import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { BotCard } from "./BotCard";
import { AddBotPanel } from "./AddBotPanel";

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
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">مدیریت ربات‌ها</h2>
        <p className="text-muted-foreground text-sm">
          در این بخش می‌توانید ربات‌های تلگرامی خود را برای ارسال پست اضافه یا مدیریت کنید.
        </p>
      </div>

      <AddBotPanel />

      {/* Bots List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">ربات‌های متصل شده</h3>
        {bots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-muted-foreground">
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
