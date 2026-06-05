/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.innerHTML.trim() !== "") return;

    // Define the callback function globally
    (window as any).onTelegramAuth = async (data: any) => {
      try {
        console.log('✔️✔️✔️ auth data', data);
        
        // The new OAuth returns an id_token (OIDC JWT) inside 'data'
        const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data), 
        });

        if (res.ok) {
          router.push("/dashboard");
          router.refresh();
        } else {
          alert("خطا در ورود به سیستم");
        }
      } catch (error) {
        console.error("Login error", error);
      }
    };

    const script = document.createElement("script");
    // Using the NEW script URL from your docs
    script.src = "https://oauth.telegram.org/js/telegram-login.js?5";
    
    // Using Client ID instead of Bot Username
    // Make sure to add NEXT_PUBLIC_TELEGRAM_CLIENT_ID to your .env
    script.setAttribute("data-client-id", process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID || "");
    script.setAttribute("data-onauth", "onTelegramAuth(data)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    containerRef.current.appendChild(script);
  }, [router]);

  return <div ref={containerRef} className="flex justify-center my-6 min-h-[40px]"></div>;
}
