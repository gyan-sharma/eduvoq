import type { Metadata } from "next";
import { ReportStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { decideReport } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Reports | Admin" };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const reports = await prisma.report.findMany({
    where: { status: ReportStatus.OPEN },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { reporter: { select: { email: true, name: true } } },
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Reports queue
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Forum, feed, and group reports land here for staff.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {reports.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No open reports.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="font-medium text-stone-900">{report.reason}</p>
              <p className="mt-1 text-sm text-stone-600">
                {report.targetType} · {report.targetId} · reported by{" "}
                {report.reporter.name ?? report.reporter.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={decideReport}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="decision" value="action" />
                  <button className={`${buttonClass} w-auto`} type="submit">
                    Actioned
                  </button>
                </form>
                <form action={decideReport}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="decision" value="dismiss" />
                  <button className={`${secondaryButtonClass} w-auto`} type="submit">
                    Dismiss
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
