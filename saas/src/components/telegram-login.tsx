"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function TelegramLogin() {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    (window as any).onTelegramAuth = async (user: Record<string, string>) => {
      const response = await fetch("/api/auth/telegram", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(user)
      });
      if (response.ok) router.push("/dashboard");
      else alert("Connexion Telegram refusée.");
    };
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    ref.current?.appendChild(script);
    return () => { delete (window as any).onTelegramAuth; };
  }, [router]);
  return <div ref={ref} className="flex min-h-12 justify-center" />;
}
