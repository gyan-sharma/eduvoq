import { NextResponse } from "next/server";
import { listPublicSlots, parseSlotRange } from "@/server/slots";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isFlagEnabled("bookings"))) {
    return NextResponse.json({ error: "Bookings are disabled." }, { status: 404 });
  }

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId is required." }, { status: 400 });
  }

  const range = parseSlotRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const service = await prisma.consultationService.findFirst({
    where: { id: serviceId, isActive: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const slots = await listPublicSlots(service, range.from, range.to);
  return NextResponse.json({ slots });
}
