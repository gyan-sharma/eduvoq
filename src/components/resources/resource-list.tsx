import Link from "next/link";
import { ResourceStatus } from "@prisma/client";
import {
  BOARD_LABELS,
  RESOURCE_KIND_LABELS,
  classLevelLabel,
  formatBytes,
} from "@/lib/resource-meta";
import type { ResourceListItem } from "@/server/resources";

export function ResourceList({
  items,
  canDownload,
  loginHref,
  empty,
}: {
  items: ResourceListItem[];
  canDownload: boolean;
  loginHref?: string;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="mt-6 text-sm text-stone-600">{empty}</p>;
  }

  return (
    <ul className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-medium text-stone-900">{item.title}</p>
            <p className="mt-1 text-sm text-stone-600">
              {RESOURCE_KIND_LABELS[item.kind]}
              {item.board ? ` · ${BOARD_LABELS[item.board]}` : ""}
              {item.classLevel ? ` · ${classLevelLabel(item.classLevel)}` : ""}
              {item.subject ? ` · ${item.subject}` : ""}
              {` · ${formatBytes(item.byteSize)}`}
            </p>
            {item.status !== ResourceStatus.PUBLISHED ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-800">
                In review
              </p>
            ) : null}
          </div>
          {canDownload ? (
            <a
              href={`/api/files/${item.fileId}`}
              className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Download
            </a>
          ) : loginHref ? (
            <Link
              href={loginHref}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              Sign in to download
            </Link>
          ) : (
            <p className="text-sm text-stone-500">Educator account required</p>
          )}
        </li>
      ))}
    </ul>
  );
}
