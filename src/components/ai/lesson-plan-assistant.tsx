"use client";

import { useActionState } from "react";

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
  classLevelLabel,
} from "@/lib/resource-meta";
import {
  generateLessonPlan,
  type LessonPlanAssistState,
} from "@/server/actions/ai";

const DURATIONS = [30, 40, 45, 60, 90] as const;

export function LessonPlanAssistant() {
  const [state, action, pending] = useActionState<
    LessonPlanAssistState,
    FormData
  >(generateLessonPlan, null);

  return (
    <section className="mt-10 rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-stone-900">
        Lesson-plan assistant
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Optional xAI helper for entitled educators. Do not enter student names
        or other personal data. The model will not produce board-exam leaks.
      </p>

      <form action={action} className="mt-4 grid gap-4">
        {state?.error ? <p className={errorClass}>{state.error}</p> : null}

        <label className="block text-sm font-medium text-stone-700">
          Topic / learning objective
          <input
            className={fieldClass}
            type="text"
            name="topic"
            required
            minLength={8}
            maxLength={500}
            placeholder="e.g. Photosynthesis in Class 7 science"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <input
              className={fieldClass}
              type="text"
              name="subject"
              maxLength={64}
              placeholder="Science"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Period (minutes)
            <select className={fieldClass} name="durationMinutes" defaultValue="40">
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className={`${buttonClass} w-auto sm:w-auto`}
          type="submit"
          disabled={pending}
        >
          {pending ? "Drafting…" : "Draft a lesson plan"}
        </button>
      </form>

      {state?.ok && state.plan ? (
        <div className="mt-4">
          <p className={successClass}>Draft ready — review before you use it.</p>
          <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-800">
            {state.plan}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
