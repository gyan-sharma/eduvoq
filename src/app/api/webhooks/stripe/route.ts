import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { ingestStripeWebhook } from "@/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const result = await ingestStripeWebhook({ rawBody, signature });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, result: result.result });
  } catch (error) {
    logger.error({ err: error }, "stripe webhook failed");
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
