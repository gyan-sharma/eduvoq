"use client";

import { useActionState, useMemo, useState } from "react";
import { buttonClass, errorClass, fieldClass, successClass } from "@/components/auth/ui";
import { setAvailability, type ExpertActionState } from "@/server/actions/expert";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type WindowDraft = {
  weekday: number;
  start: string;
  end: string;
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AvailabilityForm({
  initial,
}: {
  initial: Array<{ weekday: number; startMin: number; endMin: number }>;
}) {
  const [state, action, pending] = useActionState<ExpertActionState, FormData>(
    setAvailability,
    null,
  );
  const [rows, setRows] = useState<WindowDraft[]>(
    initial.length
      ? initial.map((row) => ({
          weekday: row.weekday,
          start: fromMinutes(row.startMin),
          end: fromMinutes(row.endMin),
        }))
      : [{ weekday: 1, start: "10:00", end: "16:00" }],
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          weekday: row.weekday,
          startMin: toMinutes(row.start),
          endMin: toMinutes(row.end),
        })),
      ),
    [rows],
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="windows" value={payload} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok ? <p className={successClass}>Hours saved (Asia/Kolkata).</p> : null}
      {rows.map((row, index) => (
        <div key={`${row.weekday}-${index}`} className="grid gap-2 sm:grid-cols-4 sm:items-end">
          <label className="text-sm font-medium text-stone-700">
            Weekday
            <select
              className={fieldClass}
              value={row.weekday}
              onChange={(event) => {
                const weekday = Number(event.target.value);
                setRows((current) =>
                  current.map((item, i) => (i === index ? { ...item, weekday } : item)),
                );
              }}
            >
              {WEEKDAYS.map((label, weekday) => (
                <option key={label} value={weekday}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-stone-700">
            Start
            <input
              className={fieldClass}
              type="time"
              value={row.start}
              onChange={(event) => {
                const start = event.target.value;
                setRows((current) =>
                  current.map((item, i) => (i === index ? { ...item, start } : item)),
                );
              }}
            />
          </label>
          <label className="text-sm font-medium text-stone-700">
            End
            <input
              className={fieldClass}
              type="time"
              value={row.end}
              onChange={(event) => {
                const end = event.target.value;
                setRows((current) =>
                  current.map((item, i) => (i === index ? { ...item, end } : item)),
                );
              }}
            />
          </label>
          <button
            type="button"
            className="text-sm text-stone-600 hover:text-stone-900"
            onClick={() =>
              setRows((current) => current.filter((_, i) => i !== index))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="text-sm font-medium text-emerald-800 hover:underline"
          onClick={() =>
            setRows((current) => [
              ...current,
              { weekday: 1, start: "10:00", end: "16:00" },
            ])
          }
        >
          Add window
        </button>
        <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save availability"}
        </button>
      </div>
    </form>
  );
}
