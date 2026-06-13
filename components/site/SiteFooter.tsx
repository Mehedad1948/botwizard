import {
  ArrowLeft,
  Bot,
  CircleCheck,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const productLinks = [
  { href: "/#features", label: "قابلیت‌ها" },
  { href: "/login", label: "ورود به حساب" },
  { href: "/dashboard", label: "داشبورد مدیریت" },
] as const;

const platformLinks = [
  {
    href: "https://core.telegram.org/bots",
    label: "ربات تلگرام",
    logo: "/Telegram_blue_icon.png",
  },
  {
    href: "https://docs.bale.ai/",
    label: "ربات بله",
    logo: "/Bale_logo.png",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer relative z-30 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fcff_24%,#f7fdfb_100%)] text-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,rgb(15_23_42/0.18)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 top-2 size-96 rounded-full bg-brand-telegram/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-44 -left-20 size-[28rem] rounded-full bg-brand-bale/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-20 size-72 -translate-x-1/2 rounded-full bg-brand-lilac/12 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-8 pt-14 sm:px-8 lg:px-12 lg:pt-20">
        <section className="site-footer-cta relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,rgba(41,169,235,0.14)_0%,rgba(255,255,255,0.92)_34%,rgba(0,184,148,0.14)_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-l from-brand-telegram/18 via-brand-telegram/8 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-brand-bale/18 via-brand-bale/8 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-[24%] top-0 h-28 rounded-full bg-brand-lilac/10 blur-3xl"
          />

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-black text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <Sparkles className="size-3.5 text-brand-lilac" />
              مدیریت حرفه‌ای انتشار محتوا
            </span>
            <h2 className="mt-5 text-2xl font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-3xl">
              ربات‌ها و کمپین‌های تلگرام و بله،
              <span className="block bg-gradient-to-l from-brand-telegram via-brand-lilac to-brand-bale bg-clip-text text-transparent">
                در یک مرکز فرمان ساده
              </span>
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
              انتشار، مقصدها و زمان‌بندی محتوا را یکپارچه مدیریت کنید و زمان
              بیشتری برای رشد کسب‌وکارتان داشته باشید.
            </p>
          </div>

          <div className="relative mt-7 flex flex-wrap items-center gap-3 lg:mt-0 lg:shrink-0">
            <Button
              asChild
              variant="brand"
              size="brand-sm"
              className="px-6 shadow-[0_16px_30px_rgba(41,169,235,0.2)]"
            >
              <Link href="/login">
                شروع مدیریت
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="brand-sm"
              className="border-white/80 bg-white/85 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] hover:border-brand-bale/30 hover:bg-brand-bale/8 hover:text-slate-950"
            >
              <Link href="/#features">مشاهده قابلیت‌ها</Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.7fr_0.8fr_1fr] lg:gap-12 lg:py-16">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="BotWizard"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-telegram via-brand-lilac to-brand-bale text-white shadow-[0_16px_32px_rgba(41,169,235,0.18)]">
                <Bot className="size-6" />
              </span>
              <span>
                <span className="block text-xl font-black tracking-tight">
                  Bot<span className="text-brand-bale">Wizard</span>
                </span>
                <span className="mt-0.5 block text-xs font-bold text-slate-400">
                  اتوماسیون تلگرام و بله
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">
              ابزار یکپارچه ساخت و مدیریت ربات، محتوا و کمپین برای پلتفرم‌های
              پیام‌رسان ایرانی و بین‌المللی.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-bale/12 bg-brand-bale/8 px-3 py-2">
                <CircleCheck className="size-3.5 text-brand-bale" />
                مدیریت چند ربات
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-telegram/12 bg-brand-telegram/8 px-3 py-2">
                <ShieldCheck className="size-3.5 text-brand-telegram" />
                اتصال امن
              </span>
            </div>
          </div>

          <FooterColumn title="محصول">
            {productLinks.map((link) => (
              <Link key={link.href} href={link.href} className="site-footer-link">
                {link.label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="پلتفرم‌ها">
            {platformLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="site-footer-link inline-flex items-center gap-2"
              >
                <Image
                  src={link.logo}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 rounded-md object-contain"
                />
                {link.label}
                <ExternalLink className="size-3 text-slate-600" />
              </a>
            ))}
          </FooterColumn>

          <div>
            <h3 className="text-sm font-black text-slate-950">ساخته‌شده برای رشد</h3>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              زیرساختی آماده برای توسعه قابلیت‌های جدید، بدون پیچیده‌کردن تجربه
              مدیریت روزمره.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {platformLinks.map((platform) => (
                <span
                  key={platform.label}
                  className="flex size-11 items-center justify-center rounded-2xl border border-white/80 bg-white/85 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                >
                  <Image
                    src={platform.logo}
                    alt={platform.label}
                    width={28}
                    height={28}
                    className="size-7 object-contain"
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p dir="ltr">© {new Date().getFullYear()} BotWizard</p>
          <p>ساخته‌شده برای مدیریت دقیق‌تر، انتشار منظم‌تر و کار کمتر.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <nav className="mt-4 flex flex-col items-start gap-3 text-sm">
        {children}
      </nav>
    </div>
  );
}
