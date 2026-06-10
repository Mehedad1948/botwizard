"use client";

import { ConfirmedActionButton } from "@/components/dashboard/ConfirmedActionButton";
import { Button } from "@/components/ui/button";
import { Bot } from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Power,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toggleBotStatusAction } from "./[botId]/actions";
import { deleteBotAction } from "./actions";

type BotWithCounts = Bot & {
  _count: { connectedChats: number; campaigns: number; posts: number };
};

export function BotCard({ bot }: { bot: BotWithCounts }) {
  return (
    <article className="dashboard-card flex flex-col gap-5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold" dir="ltr">
            @{bot.username}
          </p>
          <p
            className={`mt-1 flex items-center gap-2 text-xs font-medium ${
              bot.isActive ? "text-green-600" : "text-amber-600"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                bot.isActive ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            {bot.isActive ? "فعال و آماده دریافت" : "غیرفعال"}
          </p>
        </div>
        <Button asChild variant="brand-dark" size="sm">
          <Link href={`/dashboard/bots/${bot.id}`}>
            مدیریت کامل
            <ArrowLeft />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 border-y py-4 text-center">
        <BotStat icon={<Users />} value={bot._count.connectedChats} label="مقصد" />
        <BotStat
          icon={<CalendarClock />}
          value={bot._count.campaigns}
          label="کمپین"
        />
        <BotStat icon={<FileText />} value={bot._count.posts} label="پست" />
      </div>

      <div className="flex flex-wrap gap-2">
        <ConfirmedActionButton
          action={toggleBotStatusAction.bind(null, bot.id)}
          pendingLabel="در حال تغییر..."
        >
          <Power />
          {bot.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
        </ConfirmedActionButton>
        <ConfirmedActionButton
          action={deleteBotAction.bind(null, bot.id)}
          confirmTitle="حذف دائمی ربات؟"
          confirmDescription={`سامانه برای حذف وب‌هوک تلگرام تلاش می‌کند و ${bot._count.posts.toLocaleString("fa-IR")} پست، ${bot._count.campaigns.toLocaleString("fa-IR")} کمپین و ${bot._count.connectedChats.toLocaleString("fa-IR")} مقصد برای همیشه از سامانه پاک خواهند شد.`}
          pendingLabel="در حال حذف..."
          variant="destructive"
        >
          <Trash2 />
          حذف ربات
        </ConfirmedActionButton>
      </div>
    </article>
  );
}

function BotStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-sm font-bold [&_svg]:size-4">
        {icon}
        {value.toLocaleString("fa-IR")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
