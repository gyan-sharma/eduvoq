import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  // Prisma is not in this PR; readiness is process-up only.
  logger.info({ route: "/api/ready" }, "readiness");
  return NextResponse.json({ ok: true });
}
