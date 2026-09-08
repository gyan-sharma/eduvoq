import type { Metadata } from "next";
import { Role } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { setFeatureFlag } from "@/server/actions/admin";
import { requireStaffPage } from "@/server/admin";
import { listKnownFlags } from "@/server/flags";

export const metadata: Metadata = { title: "Flags | Admin" };

export default async function AdminFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const actor = await requireStaffPage();
  const { ok, error } = await searchParams;
  const flags = await listKnownFlags();
  const canEdit = actor.role === Role.ADMIN;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Feature flags
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Emergency switches. Only admins can change them.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      <ul className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {flags.map((flag) => (
          <li
            key={flag.key}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="font-medium text-stone-900">{flag.key}</p>
              <p className="text-sm text-stone-600">
                {flag.enabled ? "Enabled" : "Disabled"}
                {flag.fromDb ? "" : " · default"}
              </p>
            </div>
            {canEdit ? (
              <form action={setFeatureFlag}>
                <input type="hidden" name="key" value={flag.key} />
                <input
                  type="hidden"
                  name="enabled"
                  value={flag.enabled ? "false" : "true"}
                />
                <button
                  className={`${flag.enabled ? secondaryButtonClass : buttonClass} w-auto`}
                  type="submit"
                >
                  {flag.enabled ? "Disable" : "Enable"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
