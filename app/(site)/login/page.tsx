import { ArrowRight, Bot, CalendarClock, CircleCheck, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import LoginPageClient from "@/components/auth/LoginPageClient";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "ورود | BotWizard",
};

const highlights = [
  { icon: MessagesSquare, label: "مدیریت چند ربات از یک داشبورد" },
  { icon: CalendarClock, label: "زمان‌بندی دقیق کمپین‌ها" },
  { icon: CircleCheck, label: "بدون نیاز به برنامه‌نویسی" },
];

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-frame-background relative flex min-h-svh w-full min-w-0 overflow-x-clip p-3 sm:p-5 lg:h-svh">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,white_1.5px,transparent_1.5px)] [background-size:28px_28px]"
      />

      <div className="relative grid min-h-0 flex-1 overflow-hidden rounded-[1.75rem] bg-white shadow-landing sm:rounded-[2.5rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="relative flex min-h-0 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:overflow-y-auto">
          <header className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-slate-950"
              aria-label="BotWizard"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-brand-bale/20">
                <Bot className="size-5" />
              </span>
              <span className="text-lg font-black tracking-tight">
                Bot<span className="text-brand-bale">Wizard</span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <ArrowRight className="size-4" />
              بازگشت به خانه
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-10 sm:py-14 lg:py-6">
            <Suspense fallback={<LoginCardSkeleton />}>
              <LoginPageClient />
            </Suspense>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:gap-6 lg:p-10 xl:p-12">
          <div
            aria-hidden="true"
            className="absolute -left-24 -top-24 size-96 rounded-full bg-brand-telegram/35 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -right-16 size-[26rem] rounded-full bg-brand-bale/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-lilac/20 blur-3xl"
          />

          <div className="relative">
            <h2 className="text-[clamp(2rem,3.2vw,3.25rem)] font-black leading-[1.15] tracking-[-0.04em] text-white">
              ربات
              <span className="landing-telegram-text"> تلگرام </span>
              <span className="text-[0.72em] text-slate-500">و</span>
              <span className="landing-bale-text"> بله</span>
              <span className="block">خودت را بساز.</span>
            </h2>
            <ul className="mt-8 grid gap-3.5">
              {highlights.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-sm font-bold text-slate-300"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/10">
                    <Icon className="size-4 text-brand-lilac" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto min-h-0 w-full max-w-[24rem] flex-1">
            <Image
              src="/bot-wizard.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1280px) 22rem, 28vw"
              className="landing-robot-float object-contain object-bottom drop-shadow-[0_2rem_3rem_rgb(0_0_0/0.35)]"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function LoginCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-[30rem] w-full max-w-md animate-pulse rounded-3xl bg-slate-100"
    />
  );
}
