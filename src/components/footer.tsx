import Link from "next/link";

import { CONTACT_EMAIL, footerColumns } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="max-w-xs">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            EduVoq
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Connecting Educators. A professional network for school teachers and
            K-12 stakeholders.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
        {footerColumns.map((column) => (
          <div key={column.heading}>
            <p className="font-heading text-sm font-semibold">{column.heading}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {column.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} EduVoq. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <a href="/rss.xml" className="hover:text-foreground">
              RSS
            </a>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
