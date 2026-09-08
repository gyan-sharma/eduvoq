"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createThread,
  type ForumActionState,
} from "@/server/actions/forum";
import {
  buttonClass,
  errorClass,
  fieldClass,
} from "@/components/auth/ui";
import { FORUM_BODY_MAX, FORUM_TITLE_MAX } from "@/lib/forum";

export function NewThreadForm({
  categories,
  defaultCategorySlug,
  signedIn,
  canPost,
  callbackUrl,
}: {
  categories: { slug: string; name: string }[];
  defaultCategorySlug?: string;
  signedIn: boolean;
  canPost: boolean;
  callbackUrl: string;
}) {
  const [state, action, pending] = useActionState<ForumActionState, FormData>(
    createThread,
    null,
  );

  if (!canPost) {
    if (signedIn) {
      return (
        <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          <Link
            href="/complete-profile"
            className="font-medium text-primary hover:underline"
          >
            Finish your profile
          </Link>{" "}
          to start a thread. Listing stays public; posting needs an active
          member account.
        </p>
      );
    }
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>{" "}
        to start a thread. Listing stays public; posting needs an active member
        account.
      </p>
    );
  }

  const lockedCategory = Boolean(defaultCategorySlug);

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-semibold">Start a thread</h2>
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {lockedCategory ? (
        <input type="hidden" name="categorySlug" value={defaultCategorySlug} />
      ) : (
        <label className="block text-sm font-medium text-stone-700">
          Category
          <select
            className={fieldClass}
            name="categorySlug"
            defaultValue={defaultCategorySlug ?? categories[0]?.slug}
            required
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-stone-700">
        Title
        <input
          className={fieldClass}
          type="text"
          name="title"
          maxLength={FORUM_TITLE_MAX}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Post
        <textarea
          className={`${fieldClass} min-h-32`}
          name="body"
          maxLength={FORUM_BODY_MAX}
          required
        />
      </label>
      <button className={`${buttonClass} w-auto justify-self-start`} type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post thread"}
      </button>
    </form>
  );
}
