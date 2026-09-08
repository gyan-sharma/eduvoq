import type { Metadata } from "next";

import { EventForm } from "@/components/admin/event-form";

export const metadata: Metadata = { title: "New event | Admin" };

export default function AdminNewEventPage() {
  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        New event
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Write original copy. Wix science-fair and field-trip boilerplate is blocked.
      </p>
      <div className="mt-6 max-w-2xl">
        <EventForm />
      </div>
    </main>
  );
}
