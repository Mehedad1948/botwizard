"use client";

import {
  Bot,
  CalendarClock,
  CircleUserRound,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/dashboard",
    label: "داشبورد",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/bots",
    label: "مدیریت ربات‌ها",
    icon: Bot,
  },
  {
    href: "/dashboard/campaigns",
    label: "کمپین‌ها",
    icon: CalendarClock,
  },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="dashboard-shell flex h-svh overflow-hidden bg-slate-50">
      <aside className="hidden min-h-0 w-72 shrink-0 border-l border-slate-200/80 bg-white md:flex md:flex-col">
        <DashboardBrand />
        <DashboardNavigation pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-sky-100/80 bg-white/85 px-4 shadow-sm shadow-sky-950/5 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="brand-outline"
              size="icon-lg"
              className="md:hidden"
              aria-label="باز کردن منوی داشبورد"
              aria-expanded={mobileOpen}
              aria-controls="dashboard-mobile-sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="md:hidden">
              <p className="text-sm font-black text-slate-950">BotWizard</p>
              <p className="text-[11px] font-bold text-slate-700">
                پنل مدیریت
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="brand-outline"
            size="brand-sm"
            className="px-4 shadow-sm"
          >
            <CircleUserRound className="size-4" />
            پروفایل
          </Button>
        </header>

        <main className="dashboard-main-background min-w-0 flex-1 overflow-y-auto">
          <div className="relative mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label="بستن منوی داشبورد"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          id="dashboard-mobile-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="منوی داشبورد"
          className={cn(
            "absolute inset-y-0 right-0 flex w-[min(86vw,20rem)] flex-col bg-white shadow-2xl shadow-slate-950/25 transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="relative">
            <DashboardBrand />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-4 top-4 text-slate-500"
              aria-label="بستن منوی داشبورد"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </Button>
          </div>
          <DashboardNavigation
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}

function DashboardBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 px-5 transition-colors hover:bg-slate-50"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-telegram text-white shadow-lg shadow-brand-telegram/20">
        <Bot className="size-5" />
      </span>
      <span>
        <span className="block text-lg font-black tracking-tight text-slate-950">
          Bot<span className="text-brand-bale">Wizard</span>
        </span>
        <span className="block text-xs font-bold text-slate-400">
          پنل مدیریت هوشمند
        </span>
      </span>
    </Link>
  );
}

function DashboardNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
      <p className="px-3 pb-2 pt-1 text-[11px] font-black tracking-wide text-slate-400">
        منوی اصلی
      </p>
      {navigation.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold ring-1 ring-transparent transition-all duration-200",
              active
                ? "bg-sky-100 text-sky-950 ring-sky-200 shadow-sm"
                : "text-slate-600 hover:bg-sky-50 hover:text-sky-900",
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                active
                  ? "bg-sky-200/70 text-sky-700"
                  : "bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700",
              )}
            >
              <Icon className="size-4" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
