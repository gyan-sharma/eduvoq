"use client";

import { useActionState } from "react";
import {
  updateProfile,
  type ProfileActionState,
} from "@/server/actions/profile";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import {
  firstName,
  isUsernameChangeLocked,
  STUDENT_GRADES,
  studentGrade,
} from "@/lib/profile-privacy";
import type { ProfileFormUser } from "@/lib/types/user";

export function StudentProfileForm({ user }: { user: ProfileFormUser }) {
  const [profileState, profileAction, profilePending] = useActionState<
    ProfileActionState,
    FormData
  >(updateProfile, null);
  const locked = isUsernameChangeLocked(user);
  const grade = studentGrade(user.classesTaught) ?? "";

  return (
    <div className="grid gap-8">
      <p className="text-sm text-stone-600">
        Student profiles stay out of the educators directory. Only a parent can
        opt you into a first-name and grade public card — no last name, school,
        or photo.
      </p>
      <form action={profileAction} className="grid gap-4">
        {profileState?.error ? (
          <p className={errorClass}>{profileState.error}</p>
        ) : null}
        {profileState?.ok && profileState.message ? (
          <p className={successClass}>{profileState.message}</p>
        ) : null}
        <label className="block text-sm font-medium text-stone-700">
          First name
          <input
            className={fieldClass}
            name="firstName"
            defaultValue={firstName(user.name)}
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
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Grade
          <select className={fieldClass} name="grade" defaultValue={grade}>
            <option value="">Not listed</option>
            {STUDENT_GRADES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClass} type="submit" disabled={profilePending}>
          {profilePending ? "Saving…" : "Save student profile"}
        </button>
      </form>
    </div>
  );
}
