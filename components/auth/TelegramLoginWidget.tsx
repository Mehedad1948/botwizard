"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TelegramLoginResult = {
  id_token?: string;
  error?: string;
};

type TelegramLoginOptions = {
  client_id: number;
  request_access: Array<"phone" | "write">;
  lang: string;
  nonce: string;
};

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: TelegramLoginOptions,
          callback: (result: TelegramLoginResult) => void
        ) => void;
      };
    };
  }
}

const TELEGRAM_LOGIN_SCRIPT =
  "https://oauth.telegram.org/js/telegram-login.js?5";

export default function TelegramLoginWidget() {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.Telegram?.Login)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.Telegram?.Login) {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TELEGRAM_LOGIN_SCRIPT}"]`
    );
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => setScriptReady(true);
    const handleError = () =>
      setError("بارگذاری سرویس ورود تلگرام انجام نشد.");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existingScript) {
      script.src = TELEGRAM_LOGIN_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  const handleTelegramLogin = async () => {
    const clientId = Number(process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID);

    if (!scriptReady || !window.Telegram?.Login || !clientId) {
      setError("ورود تلگرام در حال حاضر در دسترس نیست.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const nonceResponse = await fetch("/api/auth/telegram/nonce", {
        method: "POST",
      });
      const nonceData = await nonceResponse.json();

      if (!nonceResponse.ok || !nonceData.nonce) {
        throw new Error("ایجاد درخواست امن ورود انجام نشد.");
      }

      window.Telegram.Login.auth(
        {
          client_id: clientId,
          request_access: ["phone", "write"],
          lang: "fa",
          nonce: nonceData.nonce,
        },
        async (result) => {
          if (result.error || !result.id_token) {
            setError(result.error || "ورود با تلگرام لغو شد.");
            setPending(false);
            return;
          }

          const response = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: result.id_token }),
          });
          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "ورود با تلگرام انجام نشد.");
            setPending(false);
            return;
          }

          router.replace("/dashboard");
          router.refresh();
        }
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "ورود با تلگرام انجام نشد."
      );
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleTelegramLogin}
        disabled={!scriptReady || pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#1b8fc7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span className="text-lg">✈</span>
        )}
        <span>{pending ? "در حال اتصال..." : "ورود مستقیم با تلگرام"}</span>
      </button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
