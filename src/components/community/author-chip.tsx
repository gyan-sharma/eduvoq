import Link from "next/link";
import { displayName, initials } from "@/lib/community";

export function AuthorChip({
  name,
  username,
  image,
}: {
  name: string | null;
  username: string | null;
  image: string | null;
}) {
  const label = displayName({ name, username });
  const avatar = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="size-10 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
    >
      {initials(label)}
    </span>
  );

  const text = (
    <span className="min-w-0">
      <span className="block truncate font-medium text-foreground">{label}</span>
      {username ? (
        <span className="block truncate text-sm text-muted-foreground">
          @{username}
        </span>
      ) : null}
    </span>
  );

  if (!username) {
    return (
      <div className="flex items-center gap-3">
        {avatar}
        {text}
      </div>
    );
  }

  return (
    <Link
      href={`/members/${username}`}
      className="flex items-center gap-3 hover:opacity-90"
    >
      {avatar}
      {text}
    </Link>
  );
}
