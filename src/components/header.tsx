import Link from "next/link";

import { MobileNav, Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { authLinks } from "@/lib/nav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-semibold text-primary-foreground">
            E
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-heading text-base font-semibold tracking-tight">
              EduVoq
            </span>
            <span className="mt-0.5 hidden text-[0.65rem] tracking-wide text-muted-foreground uppercase sm:block">
              Connecting Educators
            </span>
          </span>
        </Link>
        <Nav />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href={authLinks[0].href}>{authLinks[0].label}</Link>
          </Button>
          <Button className="hidden sm:inline-flex" asChild>
            <Link href={authLinks[1].href}>{authLinks[1].label}</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
