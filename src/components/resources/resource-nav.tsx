"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/resources", label: "Overview" },
  { href: "/resources/learning-material", label: "Learning material" },
  { href: "/resources/class-notes", label: "Class notes" },
  { href: "/resources/sample-papers", label: "Sample papers" },
];

export function ResourceNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 py-2 text-sm">
        {LINKS.map((link) => {
          const active =
            link.href === "/resources"
              ? pathname === "/resources"
              : pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "font-medium text-emerald-800"
                  : "text-stone-600 hover:text-emerald-800"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
