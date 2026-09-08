import Link from "next/link";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; exact?: boolean }[] = [
  { href: "/community", label: "Teacher Social", exact: true },
  { href: "/groups", label: "Groups" },
  { href: "/members", label: "Members" },
];

export function CommunityNav({ current }: { current: string }) {
  return (
    <nav className="mt-6 flex flex-wrap gap-2 text-sm">
      {links.map((link) => {
        const active = link.exact
          ? current === link.href
          : current === link.href || current.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
