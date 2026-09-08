export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export type StripeConfig = {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
};

export function razorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "",
  };
}

export function stripeConfig(): StripeConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() ?? "",
    publishableKey:
      process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
      "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "",
  };
}

export function razorpayCheckoutReady(config = razorpayConfig()): boolean {
  return Boolean(config.keyId && config.keySecret);
}

export function razorpayWebhookReady(config = razorpayConfig()): boolean {
  return Boolean(config.webhookSecret);
}

export function stripeCheckoutReady(config = stripeConfig()): boolean {
  return Boolean(config.secretKey);
}

export function stripeWebhookReady(config = stripeConfig()): boolean {
  return Boolean(config.webhookSecret && config.secretKey);
}
