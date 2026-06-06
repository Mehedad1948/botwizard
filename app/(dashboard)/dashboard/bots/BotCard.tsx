"use client";

import { useTransition } from "react";
import { deleteBotAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bot } from "@prisma/client";

// نوع‌دهی سفارشی برای رباتی که _count به آن اضافه شده است
type BotWithCounts = Bot & {
  _count: { connectedChats: number; campaigns: number; posts: number };
};

export function BotCard({ bot }: { bot: BotWithCounts }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      // Create and pass a dummy FormData object to satisfy the action signature
      const formData = new FormData();
      await deleteBotAction(bot.id, formData);
    });
  };

  return (
    <div className="flex flex-col p-4 border rounded-xl bg-card shadow-sm hover:shadow transition-shadow space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-lg" dir="ltr">@{bot.username}</p>
          <p className="text-xs font-medium mt-1 text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {bot.isActive ? "فعال و متصل" : "غیرفعال"}
          </p>
        </div>

        {/* Modal for Deletion */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              {isPending ? "در حال حذف..." : "حذف"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>آیا از حذف این ربات اطمینان دارید؟</AlertDialogTitle>
              <AlertDialogDescription>
                با حذف این ربات، تمامی گروه‌های متصل، کمپین‌ها و پست‌های مرتبط با آن (شامل {bot._count.campaigns} کمپین و {bot._count.posts} پست) برای همیشه حذف خواهند شد و این عملیات غیرقابل بازگشت است.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                تایید و حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Stats Section */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
        <span className="flex items-center gap-1">👥 {bot._count.connectedChats} گروه</span>
        <span className="flex items-center gap-1">📊 {bot._count.campaigns} کمپین</span>
        <span className="flex items-center gap-1">📝 {bot._count.posts} پست</span>
      </div>
    </div>
  );
}
