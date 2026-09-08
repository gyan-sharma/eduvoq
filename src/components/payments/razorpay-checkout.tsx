"use client";

import { useEffect, useRef } from "react";
import { confirmRazorpayPayment } from "@/server/actions/payments";
import type { RazorpayClientCheckout } from "@/lib/payments/types";

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpayScript(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-razorpay-checkout]",
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Razorpay) resolve(window.Razorpay);
        else reject(new Error("Razorpay failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay failed to load.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay failed to load."));
    };
    script.onerror = () => reject(new Error("Razorpay failed to load."));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  payload: RazorpayClientCheckout,
): Promise<void> {
  const Razorpay = await loadRazorpayScript();
  const checkout = new Razorpay({
    key: payload.keyId,
    amount: payload.amountPaise,
    currency: payload.currency,
    name: payload.name,
    description: payload.description,
    order_id: payload.orderId,
    prefill: {
      name: payload.prefillName,
      email: payload.prefillEmail,
    },
    theme: { color: "#065f46" },
    handler: (response) => {
      const form = new FormData();
      form.set("razorpay_order_id", response.razorpay_order_id);
      form.set("razorpay_payment_id", response.razorpay_payment_id);
      form.set("razorpay_signature", response.razorpay_signature);
      form.set("returnPath", payload.successPath);
      void confirmRazorpayPayment(null, form);
    },
  });
  checkout.open();
}

export function RazorpayAutoOpen({
  payload,
}: {
  payload: RazorpayClientCheckout | undefined;
}) {
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!payload?.orderId) return;
    if (opened.current === payload.orderId) return;
    opened.current = payload.orderId;
    void openRazorpayCheckout(payload);
  }, [payload]);
  return null;
}
