import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runCronJobs } from "@/server/jobs/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const jobs = await runCronJobs();
  return NextResponse.json({ ok: true, jobs });
}
