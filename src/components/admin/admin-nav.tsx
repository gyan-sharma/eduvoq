"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/flags", label: "Flags" },
  { href: "/admin/audit", label: "Audit" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="md:w-48 md:shrink-0">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
        Admin
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 md:flex-col md:gap-1">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  active
                    ? "block rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white"
                    : "block rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
