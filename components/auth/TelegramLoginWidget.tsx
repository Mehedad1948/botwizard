/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
console.log('👋👋👋');

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent duplicate scripts if re-rendered
    if (containerRef.current.innerHTML.trim() !== "") return;

    // Define the callback function globally for the widget to call
    (window as any).onTelegramAuth = async (user: any) => {
      try {
        console.log('✔️✔️✔️ user', user) ;
        
        const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user),
        });
        console.log('✔️✔️✔️ res', res);

        if (res.ok) {
          router.push("/dashboard");
          router.refresh();
        } else {
          alert("خطا در ورود به سیستم"); // Login failed
        }
      } catch (error) {
        console.error("Login error", error);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    containerRef.current.appendChild(script);
  }, [router]);

  return <div ref={containerRef} className="flex justify-center my-6 min-h-[40px]"></div>;
}
