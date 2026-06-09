import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CircleCheck,
  MessagesSquare,
  Play,
} from "lucide-react";
import { LandingNotch } from "@/components/landing/LandingNotch";
import { RobotHeroIllustration } from "@/components/landing/RobotHeroIllustration";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const highlights = [
  { icon: CalendarClock, label: "زمان‌بندی دقیق" },
  { icon: MessagesSquare, label: "مدیریت چند ربات" },
  { icon: CircleCheck, label: "ارسال خودکار" },
];

export default function Home() {
  return (
    <main className="landing-frame-background relative flex h-svh items-center justify-center overflow-hidden p-3 py-8 sm:py-10 sm:px-5 lg:py-20">
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


      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-visible bg-white">
        <LandingNotch className="absolute bottom-full translate-y-0.5" />
        <LandingNotch className="absolute top-full -scale-y-100 -translate-y-0.5" />

        <header className="relative z-10 flex shrink-0 items-center justify-between px-6 py-3 sm:px-10 sm:py-4 lg:px-14">
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

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-1">
          <div className="relative z-10  flex items-start px-6 pt-2 sm:px-12 sm:pt-3 lg:order-1 lg:items-center lg:px-14 lg:py-8 xl:px-20">
            <div className="mx-auto w-full max-w-xl lg:mx-0">

              <h1 className="text-[clamp(2rem,5vw,4.8rem)] font-black leading-[1.1] tracking-[-0.045em] text-slate-950">
                مدیریت تلگرام،
                <span className="landing-gradient-text mt-2 block">
                  این‌بار واقعاً جادویی!
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500 sm:mt-6 sm:text-base sm:leading-8 lg:text-lg">
                ربات‌ها، محتوا و کمپین‌های تلگرامی‌تان را از یک داشبورد ساده
                مدیریت کنید؛ شما ایده بدهید، BotWizard درست سر وقت منتشر
                می‌کند.
              </p>

              <div className="mt-5   flex gap-3 sm:mt-7 sm:flex-row">
                <Button
                  asChild
                  variant="brand"
                  size="brand"
                  className="group flex-1 sm:flex-none"
                >
                  <Link href="/login">
                    همین حالا شروع کن
                    <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                  </Link>
                </Button>
                {/* <Button
                  asChild
                  variant="glass"
                  size="brand"
                  className="hidden sm:inline-flex"
                >
                  <a href="#features">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-cyan text-slate-950">
                      <Play className="size-3.5 fill-current" />
                    </span>
                    چطور کار می‌کند؟
                  </a>
                </Button> */}
              </div>

              <div
                id="features"
                className="mt-7 hidden flex-wrap items-center gap-x-5 gap-y-3 lg:flex"
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

          <div className="relative z-0 flex min-h-0 items-center justify-center overflow-visible px-5 pb-1 pt-2 sm:px-10 sm:pb-3 lg:order-2 lg:px-10 lg:py-8 xl:px-16">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[76%] w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-[2.5rem] bg-brand-cyan/20 sm:h-[72%] sm:w-[68%] lg:w-[76%] lg:rounded-[3.5rem]"
            />
            <div
              aria-hidden="true"
              className="absolute left-[14%] top-[15%] hidden size-20 rounded-full bg-brand-pink/15 blur-xl sm:block"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[15%] right-[12%] hidden size-24 rounded-full bg-brand-lilac/20 blur-xl sm:block "
            />
            <RobotHeroIllustration />
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
