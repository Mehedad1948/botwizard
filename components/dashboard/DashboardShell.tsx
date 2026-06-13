"use client";

import { logoutAction } from "@/app/actions/auth";
import {
  Bot,
  CalendarClock,
  ChevronDown,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dashboardPath,
  isPlatformSlug,
  platformConfigs,
  type PlatformSlug,
} from "@/services/bot-platforms/config";

const navigation = [
  { suffix: "", label: "داشبورد", icon: LayoutDashboard },
  { suffix: "bots", label: "مدیریت ربات‌ها", icon: Bot },
  { suffix: "campaigns", label: "کمپین‌ها", icon: CalendarClock },
] as const;

type DashboardUser = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  telegramId: string | null;
};

export function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: DashboardUser;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const platform = getPlatformFromPath(pathname);
  const identity = useMemo(() => getUserIdentity(user), [user]);

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

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-dashboard-profile]")) return;
      setProfileOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  return (
    <div
      className="dashboard-shell flex h-svh overflow-hidden bg-slate-50"
      data-platform={platform}
    >
      <aside className="hidden min-h-0 w-72 shrink-0 border-l border-slate-200/80 bg-white md:flex md:flex-col">
        <DashboardBrand platform={platform} />
        <PlatformSwitcher pathname={pathname} platform={platform} />
        <DashboardNavigation pathname={pathname} platform={platform} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 shadow-sm shadow-slate-950/5 backdrop-blur-xl sm:px-6 lg:px-8">
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
              <p className="text-[11px] font-bold text-slate-500">
                مدیریت {platformConfigs[platform].labelFa}
              </p>
            </div>
          </div>

          <ProfileMenu
            identity={identity}
            open={profileOpen}
            onToggle={() => setProfileOpen((current) => !current)}
            onClose={() => setProfileOpen(false)}
          />
        </header>

        <main className="dashboard-main-background min-w-0 flex-1 overflow-y-auto">
          <div className="relative mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8">
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
            <DashboardBrand platform={platform} />
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
          <PlatformSwitcher pathname={pathname} platform={platform} />
          <DashboardNavigation
            pathname={pathname}
            platform={platform}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>
      </div>

      <MobileBottomNavigation pathname={pathname} platform={platform} />
    </div>
  );
}

function getPlatformFromPath(pathname: string): PlatformSlug {
  const segment = pathname.split("/")[2];
  return segment && isPlatformSlug(segment) ? segment : "telegram";
}

function platformTarget(pathname: string, target: PlatformSlug): string {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[2];
  if (section === "bots" || section === "campaigns") {
    return dashboardPath(target, section);
  }
  return dashboardPath(target);
}

function PlatformSwitcher({
  pathname,
  platform,
}: {
  pathname: string;
  platform: PlatformSlug;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-4">
      {(["telegram", "bale"] as const).map((item) => {
        const config = platformConfigs[item];
        const active = item === platform;
        return (
          <Link
            key={item}
            href={platformTarget(pathname, item)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-colors",
              active
                ? "dashboard-platform-active"
                : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700",
            )}
          >
            <Image
              src={config.logo}
              alt=""
              width={22}
              height={22}
              className={cn("size-5 object-contain", !active && "grayscale")}
            />
            {config.labelFa}
          </Link>
        );
      })}
    </div>
  );
}

function DashboardBrand({ platform }: { platform: PlatformSlug }) {
  return (
    <Link
      href={dashboardPath(platform)}
      className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 px-5 transition-colors hover:bg-slate-50"
    >
      <span className="dashboard-accent-icon flex size-11 items-center justify-center rounded-2xl">
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
  platform,
  onNavigate,
}: {
  pathname: string;
  platform: PlatformSlug;
  onNavigate?: () => void;
}) {
  return (
    <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
      <p className="px-3 pb-2 pt-1 text-[11px] font-black tracking-wide text-slate-400">
        منوی اصلی
      </p>
      {navigation.map(({ suffix, label, icon: Icon }) => {
        const href = dashboardPath(platform, suffix);
        const active =
          suffix === ""
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={suffix || "dashboard"}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "dashboard-navigation-link group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold ring-1 ring-transparent transition-all duration-200",
              !active && "text-slate-600",
            )}
          >
            <span
              className={cn(
                "dashboard-navigation-icon flex size-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
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

function ProfileMenu({
  identity,
  open,
  onToggle,
  onClose,
}: {
  identity: ReturnType<typeof getUserIdentity>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative" data-dashboard-profile="">
      <Button
        type="button"
        variant="brand-outline"
        size="brand-sm"
        className="min-w-0 gap-3 px-3 shadow-sm sm:px-4"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <span className="dashboard-navigation-icon flex size-8 shrink-0 items-center justify-center rounded-full">
          {identity.initials ? (
            <span className="text-xs font-black">{identity.initials}</span>
          ) : (
            <CircleUserRound className="size-4" />
          )}
        </span>
        <span className="hidden min-w-0 text-right sm:block">
          <span className="block truncate text-sm font-black text-slate-900">
            {identity.displayName}
          </span>
          <span className="block truncate text-[11px] font-semibold text-slate-500">
            {identity.secondary}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-slate-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </Button>

      <div
        className={cn(
          "absolute left-0 top-[calc(100%+0.75rem)] z-40 w-72 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xl shadow-slate-950/10 transition-all duration-200",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
        role="menu"
      >
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-sm font-black text-slate-950">{identity.displayName}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {identity.secondary}
          </p>
        </div>
        <form action={logoutAction} className="mt-3">
          <Button
            type="submit"
            variant="brand-outline"
            size="brand-sm"
            className="w-full justify-between px-4 text-red-600 hover:text-red-700"
            onClick={onClose}
          >
            <span>خروج از حساب</span>
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function MobileBottomNavigation({
  pathname,
  platform,
}: {
  pathname: string;
  platform: PlatformSlug;
}) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] border border-white/80 bg-white/88 px-2 py-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        {navigation.map(({ suffix, label, icon: Icon }) => {
          const href = dashboardPath(platform, suffix);
          const active =
            suffix === ""
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={suffix || "dashboard-mobile"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "dashboard-navigation-link flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition-all duration-300",
                !active && "text-slate-400",
              )}
            >
              <span className="dashboard-navigation-icon flex size-10 items-center justify-center rounded-2xl transition-all duration-300">
                <Icon className="size-4" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getUserIdentity(user: DashboardUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const displayName =
    fullName ||
    (user.username ? `@${user.username}` : null) ||
    user.phone ||
    (user.telegramId ? `ID ${user.telegramId}` : null) ||
    "کاربر";
  const secondary =
    user.phone ||
    (user.username ? `@${user.username}` : null) ||
    (user.telegramId ? `شناسه ${user.telegramId}` : null) ||
    "حساب کاربری";
  const initialsSource = fullName || user.username || user.phone || "کاربر";
  const initials = Array.from(initialsSource.replace(/^@/, "").trim())
    .slice(0, 2)
    .join("");

  return {
    displayName,
    secondary,
    initials,
  };
}
