"use client";

import { useActionState } from "react";
import {
  updateChildPrivacy,
  type ProfileActionState,
} from "@/server/actions/profile";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { STUDENT_GRADES, studentGrade } from "@/lib/profile-privacy";

export function ChildPrivacyForm({
  child,
}: {
  child: {
    id: string;
    name: string | null;
    username: string | null;
    isProfilePublic: boolean;
    classesTaught: unknown;
  };
}) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateChildPrivacy,
    null,
  );
  const grade = studentGrade(child.classesTaught) ?? "";

  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg bg-stone-50 p-4">
      <input type="hidden" name="childId" value={child.id} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
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
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          className="mt-1"
          type="checkbox"
          name="isProfilePublic"
          defaultChecked={child.isProfilePublic}
        />
        <span>
          Opt into a first-name + grade public card on Members → Student
          Circle. Last name, school, and photo stay private.
        </span>
      </label>
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update student card"}
      </button>
    </form>
  );
}
