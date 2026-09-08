"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  successClass,
} from "@/components/auth/ui";
import { votePoll, type GroupActionState } from "@/server/actions/groups";

export function PollVoteForm({
  groupPostId,
  question,
  options,
  counts,
  myOptionIdx,
  canVote,
}: {
  groupPostId: string;
  question: string;
  options: string[];
  counts: number[];
  myOptionIdx: number | null;
  canVote: boolean;
}) {
  const [state, action, pending] = useActionState<GroupActionState, FormData>(
    votePoll,
    null,
  );
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-medium text-foreground">{question}</p>
      {canVote ? (
        <form action={action} className="mt-3 grid gap-2">
          <input type="hidden" name="groupPostId" value={groupPostId} />
          {options.map((option, index) => {
            const count = counts[index] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-card"
              >
                <input
                  type="radio"
                  name="optionIdx"
                  value={index}
                  defaultChecked={myOptionIdx === index}
                  required
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground">{option}</span>
                  <span className="block text-xs text-muted-foreground">
                    {count} vote{count === 1 ? "" : "s"}
                    {total > 0 ? ` · ${pct}%` : ""}
                  </span>
                </span>
              </label>
            );
          })}
          {state?.error ? <p className={errorClass}>{state.error}</p> : null}
          {state?.ok && state.message ? (
            <p className={successClass}>{state.message}</p>
          ) : null}
          <div className="flex justify-end">
            <button
              className={`${buttonClass} w-auto`}
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : myOptionIdx === null
                  ? "Vote"
                  : "Update vote"}
            </button>
          </div>
        </form>
      ) : (
        <ul className="mt-3 grid gap-2">
          {options.map((option, index) => {
            const count = counts[index] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={option} className="text-sm">
                <span className="text-foreground">{option}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {count} vote{count === 1 ? "" : "s"}
                  {total > 0 ? ` · ${pct}%` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {total} vote{total === 1 ? "" : "s"} · one vote per member
      </p>
    </div>
  );
}
