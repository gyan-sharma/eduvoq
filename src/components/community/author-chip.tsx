import Link from "next/link";
import { displayName, initials } from "@/lib/community";
import { firstName } from "@/lib/profile-privacy";

export function AuthorChip({
  name,
  username,
  image,
  restricted = false,
}: {
  name: string | null;
  username: string | null;
  image: string | null;
  restricted?: boolean;
}) {
  const label = restricted
    ? firstName(name) || username || "Student"
    : displayName({ name, username });
  const photo = restricted ? null : image;
  const href = restricted ? null : username;

  const avatar = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className="size-10 rounded-full object-cover" />
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
      {href ? (
        <span className="block truncate text-sm text-muted-foreground">
          @{username}
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3">
        {avatar}
        {text}
      </div>
    );
  }

  return (
    <Link
      href={`/members/${href}`}
      className="flex items-center gap-3 hover:opacity-90"
    >
      {avatar}
      {text}
    </Link>
  );
}
