"use client";

import { useActionState } from "react";
import { buttonClass, errorClass, fieldClass, secondaryButtonClass } from "@/components/auth/ui";
import { cancelBooking, type BookingActionState } from "@/server/actions/booking";
import {
  completeBooking,
  setMeetingUrl,
  type ExpertActionState,
} from "@/server/actions/expert";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    cancelBooking,
    null,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button
        className={`${secondaryButtonClass} w-auto`}
        type="submit"
        disabled={pending}
      >
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
    </form>
  );
}

export function MeetingUrlForm({
  bookingId,
  current,
}: {
  bookingId: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState<ExpertActionState, FormData>(
    setMeetingUrl,
    null,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-800">Meeting link saved.</p>
      ) : null}
      <label className="block text-sm font-medium text-stone-700">
        Meeting URL
        <input
          className={fieldClass}
          type="url"
          name="meetingUrl"
          defaultValue={current ?? ""}
          placeholder="https://meet.google.com/…"
          required
        />
      </label>
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save meeting link"}
      </button>
    </form>
  );
}

export function CompleteBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<ExpertActionState, FormData>(
    completeBooking,
    null,
  );
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Mark completed"}
      </button>
    </form>
  );
}
