import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  // Process-up only; no dependency checks yet.
  return NextResponse.json({ ok: true });
}
