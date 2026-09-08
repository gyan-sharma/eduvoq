import type { ResourceKind } from "@prisma/client";
import { ResourceFilters } from "@/components/resources/resource-filters";
import { ResourceList } from "@/components/resources/resource-list";
import { UploadForm } from "@/components/resources/upload-form";
import type { ResourceListItem } from "@/server/resources";

export function ResourcePageShell({
  title,
  description,
  filterAction,
  board,
  classLevel,
  subject,
  items,
  canDownload,
  canUpload,
  defaultKind,
  kindOptions,
  loginHref,
  empty,
  teaser,
}: {
  title: string;
  description: string;
  filterAction: string;
  board?: string;
  classLevel?: string;
  subject?: string;
  items: ResourceListItem[];
  canDownload: boolean;
  canUpload: boolean;
  defaultKind?: ResourceKind;
  kindOptions?: ResourceKind[];
  loginHref?: string;
  empty: string;
  teaser?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">{description}</p>
      {teaser ? <p className="mt-3 text-sm text-stone-600">{teaser}</p> : null}

      <div className="mt-6">
        <ResourceFilters
          action={filterAction}
          board={board}
          classLevel={classLevel}
          subject={subject}
        />
      </div>

      <ResourceList
        items={items}
        canDownload={canDownload}
        loginHref={loginHref}
        empty={empty}
      />

      {canUpload && defaultKind ? (
        <section className="mt-10 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-stone-900">Upload a resource</h2>
          <p className="mt-1 text-sm text-stone-600">
            Verified educators and experts submit files for review. Staff and
            admins publish immediately.
          </p>
          <div className="mt-4">
            <UploadForm defaultKind={defaultKind} kindOptions={kindOptions} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
