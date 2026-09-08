import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  logger.info({ route: "/api/health" }, "liveness");
  return NextResponse.json({ ok: true });
}
