"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TelegramLoginResult = {
  id_token?: string;
  error?: string;
};

const TELEGRAM_OAUTH_ORIGIN = "https://oauth.telegram.org";
const TELEGRAM_POPUP_NAME = "telegram_oidc_login";

function openTelegramLogin(
  popup: Window,
  clientId: number,
  nonce: string
): Promise<TelegramLoginResult> {
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const authUrl = new URL("/auth", TELEGRAM_OAUTH_ORIGIN);
  authUrl.searchParams.set("response_type", "post_message");
  authUrl.searchParams.set("client_id", String(clientId));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "openid profile phone telegram:bot_access"
  );
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("lang", "fa");
  authUrl.searchParams.set("origin", window.location.origin);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: TelegramLoginResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closeWatcher);

      if (!popup.closed) {
        popup.close();
      }

      resolve(result);
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== TELEGRAM_OAUTH_ORIGIN ||
        event.source !== popup
      ) {
        return;
      }

      let data = event.data;

      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (!data || data.event !== "auth_result") return;

      if (typeof data.error === "string") {
        finish({ error: data.error });
        return;
      }

      if (typeof data.result !== "string") {
        finish({ error: "توکن ورود از تلگرام دریافت نشد." });
        return;
      }

      finish({ id_token: data.result });
    };

    const closeWatcher = window.setInterval(() => {
      if (popup.closed) {
        finish({ error: "پنجره ورود تلگرام بسته شد." });
      }
    }, 250);

    window.addEventListener("message", handleMessage);
    popup.location.href = authUrl.toString();
    popup.focus();
  });
}

export default function TelegramLoginWidget() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleTelegramLogin = async () => {
    if (pending) return;

    const clientId = Number(process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID);

    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      setError("شناسه ورود تلگرام به‌درستی تنظیم نشده است.");
      return;
    }

    const popup = window.open(
      "",
      TELEGRAM_POPUP_NAME,
      "width=550,height=650,status=0,location=0,menubar=0,toolbar=0"
    );

    if (!popup) {
      setError(
        "مرورگر پنجره ورود تلگرام را مسدود کرده است. اجازه نمایش پنجره‌های بازشو را فعال کنید."
      );
      return;
    }

    setPending(true);
    setError("");

    try {
      const nonceResponse = await fetch("/api/auth/telegram/nonce", {
        method: "POST",
      });
      const nonceData = await nonceResponse.json();

      if (!nonceResponse.ok || typeof nonceData.nonce !== "string") {
        throw new Error(
          nonceData.error || "ایجاد درخواست امن ورود انجام نشد."
        );
      }

      const result = await openTelegramLogin(
        popup,
        clientId,
        nonceData.nonce
      );

      if (result.error || !result.id_token) {
        throw new Error(result.error || "ورود با تلگرام لغو شد.");
      }

      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: result.id_token,
          nonce: nonceData.nonce,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ورود با تلگرام انجام نشد.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (loginError) {
      if (!popup.closed) {
        popup.close();
      }

      setError(
        loginError instanceof Error
          ? loginError.message
          : "ورود با تلگرام انجام نشد. لطفاً دوباره تلاش کنید."
      );
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleTelegramLogin}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#1b8fc7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        <span>
          {pending ? "در حال اتصال..." : "ورود مستقیم با تلگرام"}
        </span>
      </button>

      {error && (
        <p className="text-center text-xs leading-6 text-red-600">{error}</p>
      )}
    </div>
  );
}
