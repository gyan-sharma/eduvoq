import type { Metadata } from "next";
import { ResourceStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { canPublishResource } from "@/lib/admin-policy";
import { moderateResource } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Resources | Admin" };

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const resources = await prisma.resource.findMany({
    where: {
      status: { in: [ResourceStatus.IN_REVIEW, ResourceStatus.REJECTED] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { uploadedBy: { select: { email: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Resource review
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Educator uploads stay IN_REVIEW until staff publish them.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {resources.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No resources waiting for review.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="font-medium text-stone-900">{resource.title}</p>
              <p className="mt-1 text-sm text-stone-600">
                {resource.status} · {resource.kind}
                {resource.board ? ` · ${resource.board}` : ""}
                {resource.classLevel ? ` · ${resource.classLevel}` : ""} ·{" "}
                {resource.uploadedBy.name ?? resource.uploadedBy.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canPublishResource(resource.status) ? (
                  <form action={moderateResource}>
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <input type="hidden" name="decision" value="publish" />
                    <button className={`${buttonClass} w-auto`} type="submit">
                      Publish
                    </button>
                  </form>
                ) : null}
                {resource.status === ResourceStatus.IN_REVIEW ? (
                  <form action={moderateResource}>
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className={`${secondaryButtonClass} w-auto`} type="submit">
                      Reject
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
