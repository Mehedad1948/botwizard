"use client";

import { Bot, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddBotForm } from "./AddBotForm";

export function AddBotPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <Button
        type="button"
        size="brand-sm"
        className="min-w-40"
        aria-expanded={open}
        aria-controls="add-bot-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Bot className="size-4" />
        افزودن ربات جدید
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </Button>

      {open && (
        <div
          id="add-bot-panel"
          className="dashboard-card space-y-6 rounded-2xl bg-white p-5 sm:p-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
            <h3 className="mb-3 text-base font-black text-slate-900">
              راهنمای دریافت توکن ربات
            </h3>
            <ol className="list-inside list-decimal space-y-2">
              <li>
                در تلگرام وارد{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-sky-600 hover:underline"
                  dir="ltr"
                >
                  @BotFather
                </a>{" "}
                شوید.
              </li>
              <li>
                دستور{" "}
                <code
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800"
                  dir="ltr"
                >
                  /newbot
                </code>{" "}
                را ارسال کنید.
              </li>
              <li>
                یک نام و سپس نام کاربری مختوم به{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                  bot
                </code>{" "}
                بفرستید.
              </li>
              <li>توکن دریافتی را در کادر زیر وارد کنید.</li>
            </ol>
          </div>

          <AddBotForm />
        </div>
      )}
    </section>
  );
}
