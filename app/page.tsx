import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CircleCheck,
  MessagesSquare,
  Play,
  Sparkles,
} from "lucide-react";
import { LandingNotch } from "@/components/landing/LandingNotch";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

const highlights = [
  { icon: CalendarClock, label: "زمان‌بندی دقیق" },
  { icon: MessagesSquare, label: "مدیریت چند ربات" },
  { icon: CircleCheck, label: "ارسال خودکار" },
];

export default function Home() {
  return (
    <main className="landing-frame-background relative flex h-svh items-center justify-center overflow-hidden p-3 sm:p-5 lg:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,white_1.5px,transparent_1.5px)] [background-size:28px_28px]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 top-6 size-64 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-16 bottom-0 size-72 rounded-full bg-brand-lilac/40 blur-3xl"
      />


      <div className=" relative  overflow-visible  flex min-h-0 flex-1 flex-col h-full  bg-white ">
        <LandingNotch className="absolute bottom-full translate-y-0.5" />
        <LandingNotch className="absolute top-full -scale-y-100 -translate-y-0.5" />

        <header className="relative z-10 flex  shrink-0 items-center justify-between px-6 sm:px-10 lg:px-14">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-950"
            aria-label="Bot Wizard"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-brand-pink/20">
              <Bot className="size-5" />
            </span>
            <span className="text-lg font-black tracking-tight">
              Bot<span className="text-brand-pink">Wizard</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="brand-ghost"
              size="brand-sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/login">ورود</Link>
            </Button>
            <Button
              asChild
              variant="brand-dark"
              size="brand-sm"
              className="group px-4 text-xs sm:px-5 sm:text-sm"
            >
              <Link href="/login">
                شروع رایگان
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </Link>
            </Button>
          </nav>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="relative z-10 flex items-center px-7 pt-3 sm:px-12 lg:order-1 lg:px-14 lg:pt-8 xl:px-20">
            <div className="mx-auto w-full max-w-xl lg:mx-0">

              <h1 className="text-[clamp(2.25rem,4.2vw,4.8rem)] font-black leading-[1.1] tracking-[-0.045em] text-slate-950">
                مدیریت تلگرام،
                <span className="landing-gradient-text mt-2 block">
                  این‌بار واقعاً جادویی!
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-sm leading-7 text-slate-500 sm:text-base sm:leading-8 lg:text-lg">
                ربات‌ها، محتوا و کمپین‌های تلگرامی‌تان را از یک داشبورد ساده
                مدیریت کنید؛ شما ایده بدهید، BotWizard درست سر وقت منتشر
                می‌کند.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  variant="brand"
                  size="brand"
                  className="group"
                >
                  <Link href="/login">
                    همین حالا شروع کن
                    <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="brand-outline" size="brand">
                  <a href="#features">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-cyan text-slate-950">
                      <Play className="size-3.5 fill-current" />
                    </span>
                    چطور کار می‌کند؟
                  </a>
                </Button>
              </div>

              <div
                id="features"
                className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3"
              >
                {highlights.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500"
                  >
                    <Icon className="size-4 text-brand-lilac" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative hidden min-h-0 items-center justify-center overflow-hidden px-10 py-8 lg:order-2 lg:flex xl:px-16">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[72%] w-[76%] -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-[3.5rem] bg-brand-cyan/20"
            />
            <div
              aria-hidden="true"
              className="absolute left-[14%] top-[15%] size-20 rounded-full bg-brand-pink/15 blur-xl"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[15%] right-[12%] size-24 rounded-full bg-brand-lilac/20 blur-xl"
            />
            <div className="relative h-full max-h-[660px] w-full max-w-[680px] flex items-center justify-center">
              <div className="w-fit relative">


                <Image
                  src="/bot-wizard.png"
                  alt="نمایی شاد از مدیریت ربات‌ها و کمپین‌های تلگرامی در BotWizard"
                  width={600}
                  height={400}
                  preload
                  className="object-contain lg:w-100"
                />
                <Image
                  src="/sparkles.png"
                  alt="نمایی شاد از مدیریت ربات‌ها و کمپین‌های تلگرامی در BotWizard"
                  width={200}
                  height={200}
                  preload
                  className="object-contain w-24 absolute right-0 top-16 animate-bounce"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-5 left-6 hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300 sm:flex lg:left-12">
          <span className="h-px w-8 bg-slate-200" />
          Telegram Automation
        </div>
      </div>


    </main>
  );
}
