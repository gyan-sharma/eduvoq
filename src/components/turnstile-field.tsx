"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: { sitekey: string; theme?: "light" | "auto" | "dark" },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileField({ siteKey }: { siteKey: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !siteKey) return;

    let widgetId: string | undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      widgetId = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        theme: "auto",
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (window.turnstile) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render);
    } else {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [siteKey]);

  return <div ref={hostRef} className="mt-1" />;
}
