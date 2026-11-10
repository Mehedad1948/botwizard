"use client";

import { verifyOtpAction } from "@/app/actions/auth";
import TelegramLoginWidget from "@/components/auth/TelegramLoginWidget";
import {
  ArrowRight,
  Bot,
  Loader2,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from "react";

function OtpInput({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: (code: string) => void;
}) {
  const length = 5;
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const updateDigit = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;

    const nextOtp = [...otp];
    nextOtp[index] = value.slice(-1);
    setOtp(nextOtp);

    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (nextOtp.every(Boolean)) {
      onComplete(nextOtp.join(""));
    }
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);

    if (!pastedCode) return;

    const nextOtp = Array.from(
      { length },
      (_, index) => pastedCode[index] ?? "",
    );
    setOtp(nextOtp);
    inputRefs.current[Math.min(pastedCode.length, length - 1)]?.focus();

    if (pastedCode.length === length) {
      onComplete(pastedCode);
    }
  };

  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`رقم ${index + 1}`}
          className={`h-14 w-12 rounded-2xl border-2 text-center text-xl font-black outline-none transition sm:w-14 ${
            digit
              ? "border-brand-telegram bg-brand-telegram/8 text-slate-950"
              : "border-slate-200 bg-slate-50 focus:border-brand-telegram focus:bg-white focus:ring-4 focus:ring-brand-telegram/15"
          } disabled:opacity-50`}
        />
      ))}
    </div>
  );
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showBotHelp, setShowBotHelp] = useState(false);

  const linkError =
    searchParams.get("error") === "expired_link"
      ? "لینک ورود منقضی یا قبلاً استفاده شده است. دوباره درخواست ورود بدهید."
      : searchParams.get("error") === "invalid_link"
        ? "لینک ورود معتبر نیست."
        : "";
  const visibleError = error || linkError;

  const requestOtp = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setShowBotHelp(false);

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await response.json();

      if (response.status === 404) {
        setShowBotHelp(true);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message);
      }

      setMaskedPhone(data.maskedPhone);
      setStep("verify");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ارسال پیام ورود انجام نشد.",
      );
    } finally {
      setPending(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setPending(true);
    setError("");

    const response = await verifyOtpAction(code);

    if (response.error) {
      setError(response.error);
      setPending(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  const returnToPhone = () => {
    setStep("phone");
    setError("");
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
          ورود به حساب
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          با حساب تلگرام وارد شوید یا کد تایید را از ربات دریافت کنید.
        </p>
      </div>

      <TelegramLoginWidget />

      <div className="my-7 flex items-center gap-3 text-xs font-bold text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>یا ورود با شماره متصل به ربات</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {visibleError && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-xs leading-6 text-red-600"
        >
          <p>{visibleError}</p>
          {showBotHelp && (
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-telegram py-2.5 font-bold text-white transition hover:bg-[#168acd]"
            >
              <Bot className="h-4 w-4" />
              <span>اتصال شماره در ربات تلگرام</span>
            </a>
          )}
        </div>
      )}

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <label htmlFor="login-phone" className="sr-only">
            شماره موبایل
          </label>
          <div className="relative">
            <input
              id="login-phone"
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0912..."
              autoComplete="tel"
              dir="ltr"
              className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-12 text-left text-lg tracking-wide text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-telegram focus:bg-white focus:ring-4 focus:ring-brand-telegram/15"
            />
            <Phone className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 className="size-5 animate-spin" />}
            <span>
              {pending ? "در حال ارسال..." : "دریافت پیام ورود در تلگرام"}
            </span>
          </button>
        </form>
      ) : (
        <div className="space-y-7">
          <div className="relative text-center">
            <button
              type="button"
              onClick={returnToPhone}
              className="absolute right-0 top-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
              title="بازگشت"
              aria-label="بازگشت به وارد کردن شماره"
            >
              <ArrowRight className="size-5" />
            </button>
            <p className="text-sm font-black text-slate-950">
              کد پنج رقمی را وارد کنید
            </p>
            <p className="mt-2 text-xs text-slate-500">
              پیام ورود برای شماره {maskedPhone} ارسال شد.
            </p>
          </div>
          <OtpInput disabled={pending} onComplete={verifyOtp} />
          {pending && (
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-brand-telegram">
              <Loader2 className="size-4 animate-spin" />
              <span>در حال اعتبارسنجی...</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-slate-100 pt-6">
        <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" />
          <span>ورود شما به معنای پذیرش</span>
          <Link
            href="/policy"
            className="text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-brand-telegram"
          >
            قوانین و حریم خصوصی
          </Link>
          <span>است.</span>
        </p>
      </div>
    </div>
  );
}
