"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: { sitekey: string; theme?: "light" | "auto" | "dark" },
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileField({
  siteKey,
  resetOn,
}: {
  siteKey: string;
  resetOn?: unknown;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !siteKey) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
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
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = undefined;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetOn == null) return;
    const widgetId = widgetIdRef.current;
    if (widgetId && window.turnstile?.reset) {
      window.turnstile.reset(widgetId);
    }
  }, [resetOn]);

  return <div ref={hostRef} className="mt-1" />;
}
