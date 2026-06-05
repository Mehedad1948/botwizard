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
          توکن ربات خود را از BotFather@ دریافت کرده و اینجا وارد کنید.
        </p>
      </div>

      {/* Add Bot Form */}
      <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
        <form action={addBotAction} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              توکن ربات (Bot Token)
            </label>
            <input
              type="text"
              id="token"
              name="token"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left"
              dir="ltr"
              required
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
               <div key={bot.id} className="flex items-center justify-between p-4 border rounded-xl bg-card">
                 <div>
                   <p className="font-semibold" dir="ltr">@{bot.username}</p>
                   <p className="text-xs text-muted-foreground mt-1 text-green-500">
                     {bot.isActive ? "فعال" : "غیرفعال"}
                   </p>
                 </div>
                 <form action={deleteBotAction.bind(null, bot.id)}>
                   <button 
                     type="submit" 
                     className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-md transition-colors"
                   >
                     حذف
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
