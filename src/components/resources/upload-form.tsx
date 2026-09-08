"use client";

import { useActionState } from "react";
import type { ResourceKind } from "@prisma/client";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import {
  BOARD_LABELS,
  BOARD_VALUES,
  CLASS_LEVELS,
  RESOURCE_KIND_LABELS,
  classLevelLabel,
} from "@/lib/resource-meta";
import {
  uploadResource,
  type ResourceActionState,
} from "@/server/actions/resources";

export function UploadForm({
  defaultKind,
  kindOptions,
}: {
  defaultKind: ResourceKind;
  kindOptions?: ResourceKind[];
}) {
  const [state, action, pending] = useActionState<ResourceActionState, FormData>(
    uploadResource,
    null,
  );
  const kinds = kindOptions?.length ? kindOptions : [defaultKind];

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}

      <label className="block text-sm font-medium text-stone-700">
        Title
        <input
          className={fieldClass}
          type="text"
          name="title"
          required
          minLength={3}
          maxLength={191}
        />
      </label>

      {kinds.length > 1 ? (
        <label className="block text-sm font-medium text-stone-700">
          Type
          <select className={fieldClass} name="kind" defaultValue={defaultKind}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {RESOURCE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="kind" value={defaultKind} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-stone-700">
          Board
          <select className={fieldClass} name="board" defaultValue="">
            <option value="">Any</option>
            {BOARD_VALUES.map((board) => (
              <option key={board} value={board}>
                {BOARD_LABELS[board]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Class
          <select className={fieldClass} name="classLevel" defaultValue="">
            <option value="">Any</option>
            {CLASS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {classLevelLabel(level)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Subject
          <input className={fieldClass} type="text" name="subject" maxLength={64} />
        </label>
      </div>

      <label className="block text-sm font-medium text-stone-700">
        File
        <input
          className={fieldClass}
          type="file"
          name="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        />
      </label>
      <p className="text-xs text-stone-500">
        PDF, JPEG, PNG, or WebP. PDFs up to 25 MB; images up to 5 MB. Educator
        uploads go to review before they appear in the library.
      </p>
      <button className={`${buttonClass} w-auto sm:w-auto`} type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
