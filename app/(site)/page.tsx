import {
  CalendarClock,
  LayoutDashboard,
  MessagesSquare,
  Send,
} from "lucide-react";

import { LandingHero } from "@/components/landing/LandingHero";
import { PageSection } from "@/components/landing/PageSection";

const placeholderSections = [
  {
    eyebrow: "مدیریت یکپارچه",
    title: "همه‌چیز در یک داشبورد ساده",
    description:
      "این بخش جای محتوای اصلی شماست. می‌توانید هر Server Component، داده واکشی‌شده یا رابط سفارشی را داخل PageSection.Content قرار دهید.",
    icon: LayoutDashboard,
    accent: "from-sky-400 to-cyan-300",
    card: "bg-sky-50",
  },
  {
    eyebrow: "زمان‌بندی هوشمند",
    title: "انتشار دقیق، بدون کار تکراری",
    description:
      "برای معرفی قابلیت دوم، تصویر یا دموی محصول را در بخش تصویر و توضیحات، دکمه‌ها یا لیست مزایا را در بخش محتوا قرار دهید.",
    icon: CalendarClock,
    accent: "from-emerald-400 to-teal-300",
    card: "bg-emerald-50",
    reverse: true,
  },
  {
    eyebrow: "ارتباط گسترده",
    title: "یک پیام، چند مقصد",
    description:
      "ساختار این سکشن‌ها کاملاً قابل جایگزینی است و انیمیشن ورود بدون نیاز به تبدیل محتوای داخلی به Client Component اجرا می‌شود.",
    icon: MessagesSquare,
    accent: "from-violet-400 to-fuchsia-300",
    card: "bg-violet-50",
  },
];

export default function Home() {
  return (
    <main className="relative w-full min-w-0 overflow-x-clip bg-slate-950">
      <LandingHero />

      <div className="landing-content-surface relative z-10 bg-white">
        <div>
          {placeholderSections.map(
            ({
              eyebrow,
              title,
              description,
              icon: Icon,
              accent,
              card,
              reverse,
            }, index) => (
              <PageSection
                key={title}
                reverse={reverse}
                stackIndex={index + 1}
              >
                <PageSection.Image>
                  <div
                    className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[2rem] ${card} p-8 shadow-[0_20px_50px_rgb(109_40_217/0.11)] sm:rounded-[3rem]`}
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute -left-[12%] -top-[18%] size-[58%] rounded-full bg-gradient-to-br ${accent} opacity-35 blur-3xl`}
                    />
                    <div className="relative w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_16px_36px_rgb(109_40_217/0.1)] backdrop-blur">
                      <div className="flex items-center justify-between">
                        <span className="h-2.5 w-24 rounded-full bg-slate-200" />
                        <span
                          className={`flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}
                        >
                          <Icon className="size-5" />
                        </span>
                      </div>
                      <div className="mt-7 grid gap-3">
                        <span className="h-12 rounded-2xl bg-slate-100" />
                        <span className="h-12 rounded-2xl bg-slate-100/80" />
                        <span className="h-12 rounded-2xl bg-slate-100/60" />
                      </div>
                    </div>
                  </div>
                </PageSection.Image>

                <PageSection.Content>
                  <span className="text-sm font-black text-brand-bale">
                    {eyebrow}
                  </span>
                  <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
                    {title}
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-8 text-slate-500 sm:text-lg">
                    {description}
                  </p>
                  <div className="mt-7 inline-flex items-center gap-2 text-sm font-black text-slate-900">
                    <Send className="size-4 text-brand-telegram" />
                    محل دکمه یا فراخوان اقدام
                  </div>
                </PageSection.Content>
              </PageSection>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
