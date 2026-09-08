"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; exact?: boolean }[] = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/settings", label: "Settings" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/bookings", label: "Bookings" },
  { href: "/account/wallet", label: "Wallet" },
];

export function AccountNav({ username }: { username: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-stone-200 pb-4 text-sm">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              active
                ? "bg-emerald-800 text-white"
                : "text-stone-700 hover:bg-stone-100",
            )}
          >
            {link.label}
          </Link>
        );
      })}
      {username ? (
        <Link
          href={`/members/${username}`}
          className="rounded-md px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
        >
          Public profile
        </Link>
      ) : null}
    </nav>
  );
}
