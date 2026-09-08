"use client";

import { useActionState } from "react";
import { Board } from "@prisma/client";
import { updateProfile, type ProfileActionState } from "@/server/actions/profile";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import {
  asStringArray,
  BOARD_LABELS,
  isUsernameChangeLocked,
} from "@/lib/profile-privacy";
import type { ProfileFormUser } from "@/lib/types/user";

const boards = Object.values(Board);

export function ProfileForm({ user }: { user: ProfileFormUser }) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateProfile,
    null,
  );
  const locked = isUsernameChangeLocked(user);
  const subjects = asStringArray(user.subjects).join(", ");
  const classesTaught = asStringArray(user.classesTaught).join(", ");

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <label className="block text-sm font-medium text-stone-700">
        Display name
        <input
          className={fieldClass}
          name="name"
          defaultValue={user.name ?? ""}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Username
        <input
          className={fieldClass}
          name="username"
          defaultValue={user.username ?? ""}
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9_]{3,32}"
          readOnly={locked}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
          {locked
            ? "Username is locked after 14 days."
            : "3–32 characters, lowercase letters, numbers, underscore. Locked 14 days after you join."}
        </span>
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Headline
        <input
          className={fieldClass}
          name="headline"
          defaultValue={user.headline ?? ""}
          maxLength={191}
          placeholder="Primary teacher · CBSE · Bengaluru"
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Bio
        <textarea
          className={fieldClass}
          name="bio"
          rows={5}
          defaultValue={user.bio ?? ""}
          maxLength={4000}
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        School
        <input
          className={fieldClass}
          name="schoolName"
          defaultValue={user.schoolName ?? ""}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          City
          <input className={fieldClass} name="city" defaultValue={user.city ?? ""} />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          State
          <input
            className={fieldClass}
            name="state"
            defaultValue={user.state ?? ""}
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-stone-700">
        Board
        <select
          className={fieldClass}
          name="boardAffiliation"
          defaultValue={user.boardAffiliation ?? ""}
        >
          <option value="">Prefer not to say</option>
          {boards.map((board) => (
            <option key={board} value={board}>
              {BOARD_LABELS[board]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Subjects
        <input
          className={fieldClass}
          name="subjects"
          defaultValue={subjects}
          placeholder="Mathematics, Science"
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Classes taught
        <input
          className={fieldClass}
          name="classesTaught"
          defaultValue={classesTaught}
          placeholder="6, 7, 8"
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        LinkedIn URL
        <input
          className={fieldClass}
          name="linkedinUrl"
          type="url"
          defaultValue={user.linkedinUrl ?? ""}
          placeholder="https://www.linkedin.com/in/…"
        />
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
