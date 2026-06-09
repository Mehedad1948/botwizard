// src/app/layout.tsx
import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./tailwindcss.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const vazirmatn = Vazirmatn({ subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "BotWizard | مدیریت و زمان‌بندی تلگرام",
  description:
    "مدیریت ربات‌ها، محتوا و زمان‌بندی خودکار کمپین‌های تلگرامی از یک داشبورد ساده.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className={vazirmatn.className}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
