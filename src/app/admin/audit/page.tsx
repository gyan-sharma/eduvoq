import type { Metadata } from "next";

import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Audit | Admin" };

export default async function AdminAuditPage() {
  const rows = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Audit log
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Staff actions on users, content, flags, bookings, and orders.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No audit events yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">When (UTC)</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-stone-600">
                    {row.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2">
                    {row.actor?.email ?? "system"}
                  </td>
                  <td className="px-4 py-2 font-medium text-stone-900">
                    {row.action}
                  </td>
                  <td className="px-4 py-2 text-stone-600">
                    {row.entity} · {row.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
