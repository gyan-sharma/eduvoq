"use client";

import { useActionState } from "react";
import {
  reportContent,
  type ForumActionState,
} from "@/server/actions/forum";
import {
  errorClass,
  fieldClass,
  secondaryButtonClass,
  successClass,
} from "@/components/auth/ui";
import { REPORT_REASONS } from "@/lib/forum";

export function ReportForm({
  targetType,
  targetId,
  canPost,
}: {
  targetType: "FORUM_POST" | "FORUM_THREAD";
  targetId: string;
  canPost: boolean;
}) {
  const [state, action, pending] = useActionState<ForumActionState, FormData>(
    reportContent,
    null,
  );

  if (!canPost) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Report
      </summary>
      <form action={action} className="mt-2 grid max-w-xs gap-2">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        {state?.error ? <p className={errorClass}>{state.error}</p> : null}
        {state?.ok ? (
          <p className={successClass}>{state.message ?? "Reported."}</p>
        ) : null}
        <label className="block text-xs font-medium text-stone-700">
          Reason
          <select className={fieldClass} name="reason" defaultValue="spam" required>
            {REPORT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className={`${secondaryButtonClass} w-auto`}
        >
          {pending ? "Sending…" : "Submit report"}
        </button>
      </form>
    </details>
  );
}
