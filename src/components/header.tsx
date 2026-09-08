import Link from "next/link";
import { Role } from "@prisma/client";

import { MobileNav, Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { authLinks } from "@/lib/nav";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export async function Header() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const staff =
    session?.user?.role === Role.STAFF || session?.user?.role === Role.ADMIN;

  return (
    <header className="sticky top-0 z-40 isolate overflow-visible border-b">
      {/* Blur on a sibling layer so it does not clip the nav viewport. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background/90 backdrop-blur-md"
      />
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8 2xl:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-semibold text-primary-foreground">
            E
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-heading text-base font-semibold tracking-tight">
              {SITE_NAME}
            </span>
            <span className="mt-0.5 hidden text-[0.65rem] tracking-wide text-muted-foreground uppercase sm:block xl:hidden 2xl:block">
              {SITE_TAGLINE}
            </span>
          </span>
        </Link>
        <Nav />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {signedIn ? (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                <Link href="/cart">Cart</Link>
              </Button>
              {staff ? (
                <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <Button className="hidden sm:inline-flex" asChild>
                <Link href="/account">Account</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                <Link href={authLinks[0].href}>{authLinks[0].label}</Link>
              </Button>
              <Button className="hidden sm:inline-flex" asChild>
                <Link href={authLinks[1].href}>{authLinks[1].label}</Link>
              </Button>
            </>
          )}
          <MobileNav signedIn={signedIn} staff={staff} />
        </div>
      </div>
    </header>
  );
}
