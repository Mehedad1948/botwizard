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
  Suspense,
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
    event: KeyboardEvent<HTMLInputElement>
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
      (_, index) => pastedCode[index] ?? ""
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
          className={`h-14 w-12 rounded-xl border-2 text-center text-xl font-bold outline-none transition ${
            digit
              ? "border-amber-500 bg-amber-50 text-amber-900"
              : "border-gray-200 bg-gray-50 focus:border-amber-400 focus:bg-white"
          } disabled:opacity-50`}
        />
      ))}
    </div>
  );
}

function LoginForm() {
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
          : "ارسال پیام ورود انجام نشد."
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
    <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/60 p-8 shadow-2xl shadow-gray-200/50 backdrop-blur dark:bg-gray-900 dark:shadow-black/50 md:bg-white">
      <div className="mb-7 text-center">
        <p className="mb-2 text-sm font-medium text-amber-600">BotWizard</p>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          ورود به حساب کاربری
        </h1>
        <p className="mt-2 text-xs leading-6 text-gray-500 dark:text-gray-400">
          با حساب تلگرام وارد شوید یا کد تأیید را از ربات دریافت کنید.
        </p>
      </div>

      <TelegramLoginWidget />

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span>یا ورود با شماره متصل به ربات</span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      {visibleError && (
        <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-xs leading-6 text-red-600 dark:border-red-800 dark:bg-red-900/10 dark:text-red-300">
          <p>{visibleError}</p>
          {showBotHelp && (
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-bold text-white transition hover:bg-blue-700"
            >
              <Bot className="h-4 w-4" />
              <span>اتصال شماره در ربات تلگرام</span>
            </a>
          )}
        </div>
      )}

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="space-y-5">
          <div className="relative">
            <input
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0912..."
              autoComplete="tel"
              dir="ltr"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-4 pr-12 text-left font-mono text-lg text-gray-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <Phone className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white shadow-lg transition hover:bg-amber-600 disabled:opacity-60 dark:text-gray-900"
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin" />}
            <span>{pending ? "در حال ارسال..." : "دریافت پیام ورود در تلگرام"}</span>
          </button>
        </form>
      ) : (
        <div className="space-y-7">
          <div className="relative text-center">
            <button
              type="button"
              onClick={returnToPhone}
              className="absolute right-0 top-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100"
              title="بازگشت"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="text-sm font-bold text-gray-800 dark:text-white">
              کد پنج‌رقمی را وارد کنید
            </p>
            <p className="mt-2 text-xs text-gray-500">
              پیام ورود برای شماره {maskedPhone} ارسال شد.
            </p>
          </div>
          <OtpInput disabled={pending} onComplete={verifyOtp} />
          {pending && (
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>در حال اعتبارسنجی...</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-gray-100 pt-6 text-center dark:border-gray-800">
        <p className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-gray-400">
          <ShieldCheck className="h-3 w-3" />
          <span>ورود شما به معنای پذیرش</span>
          <Link
            href="/policy"
            className="text-gray-600 underline decoration-gray-300 underline-offset-2 transition hover:text-amber-600 dark:text-gray-300"
          >
            قوانین و حریم خصوصی
          </Link>
          <span>است.</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950"
      dir="rtl"
    >
      <Suspense
        fallback={<Loader2 className="h-8 w-8 animate-spin text-amber-500" />}
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
