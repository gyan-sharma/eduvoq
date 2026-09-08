"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  followUser,
  unfollowUser,
  type FollowActionState,
} from "@/server/actions/follow";
import { buttonClass, errorClass, secondaryButtonClass } from "@/components/auth/ui";

export function FollowButton({
  username,
  isFollowing,
  signedIn,
  canFollow,
  blockedReason,
}: {
  username: string;
  isFollowing: boolean;
  signedIn: boolean;
  canFollow: boolean;
  blockedReason?: string;
}) {
  const action = isFollowing ? unfollowUser : followUser;
  const [state, formAction, pending] = useActionState<FollowActionState, FormData>(
    action,
    null,
  );

  if (!signedIn) {
    return (
      <Link
        href={`/login?callbackUrl=/members/${encodeURIComponent(username)}`}
        className={`${buttonClass} w-auto`}
      >
        Follow
      </Link>
    );
  }

  if (!canFollow && !isFollowing) {
    return blockedReason ? (
      <p className="text-sm text-muted-foreground">{blockedReason}</p>
    ) : null;
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="username" value={username} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={`${isFollowing ? secondaryButtonClass : buttonClass} w-auto`}
      >
        {pending
          ? isFollowing
            ? "Unfollowing…"
            : "Following…"
          : isFollowing
            ? "Unfollow"
            : "Follow"}
      </button>
    </form>
  );
}
