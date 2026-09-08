"use client";

import { useActionState } from "react";

import { TiptapEditor } from "@/components/admin/tiptap-editor";
import {
  buttonClass,
  errorClass,
  fieldClass,
} from "@/components/auth/ui";
import { toKolkataDateTimeLocal } from "@/lib/kolkata";
import { saveEvent } from "@/server/actions/events";
import type { AdminActionState } from "@/server/admin";

export function EventForm({
  event,
}: {
  event?: {
    id: string;
    title: string;
    slug: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    isOnline: boolean;
    capacity: number | null;
    pricePaise: number;
    published: boolean;
    descriptionJson: unknown;
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    saveEvent,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <label className="block text-sm font-medium text-stone-700">
        Title
        <input
          className={fieldClass}
          name="title"
          defaultValue={event?.title ?? ""}
          required
        />
      </label>
      {event ? (
        <p className="text-sm text-stone-600">Slug: {event.slug}</p>
      ) : (
        <label className="block text-sm font-medium text-stone-700">
          Slug (optional)
          <input
            className={fieldClass}
            name="slug"
            placeholder="Generated from the title"
          />
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Starts (IST)
          <input
            className={fieldClass}
            type="datetime-local"
            name="startsAt"
            required
            defaultValue={
              event ? toKolkataDateTimeLocal(event.startsAt) : ""
            }
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Ends (IST, optional)
          <input
            className={fieldClass}
            type="datetime-local"
            name="endsAt"
            defaultValue={
              event?.endsAt ? toKolkataDateTimeLocal(event.endsAt) : ""
            }
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          name="isOnline"
          defaultChecked={event?.isOnline ?? true}
        />
        Online event
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Location
        <input
          className={fieldClass}
          name="location"
          defaultValue={event?.location ?? ""}
          placeholder="Zoom / Delhi / campus"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Capacity (blank = unlimited)
          <input
            className={fieldClass}
            name="capacity"
            type="number"
            min={1}
            defaultValue={event?.capacity ?? ""}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Price (₹, 0 = free)
          <input
            className={fieldClass}
            name="priceRupees"
            type="number"
            min={0}
            step="1"
            defaultValue={
              event ? String(Math.round(event.pricePaise / 100)) : "0"
            }
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          name="published"
          defaultChecked={event?.published ?? false}
        />
        Published
      </label>
      <div>
        <p className="mb-1 text-sm font-medium text-stone-700">Description</p>
        <TiptapEditor
          name="bodyJson"
          initial={event?.descriptionJson}
          placeholder="Write the real event copy. Do not paste Wix boilerplate."
        />
      </div>
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save event"}
      </button>
    </form>
  );
}
