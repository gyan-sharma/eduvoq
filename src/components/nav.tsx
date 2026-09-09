"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  authLinks,
  primaryNav,
  type NavGroup,
  type PrimaryNavItem,
} from "@/lib/nav";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isClusterActive(pathname: string, item: Extract<PrimaryNavItem, { type: "cluster" }>) {
  if (item.activeHref && isActivePath(pathname, item.activeHref)) {
    return true;
  }
  return item.groups.some((group) =>
    group.items.some((link) => isActivePath(pathname, link.href)),
  );
}

const desktopTriggerClass = cn(
  navigationMenuTriggerStyle(),
  "px-1.5 data-active:bg-muted/50 2xl:px-2.5",
);

function ClusterLinks({
  groups,
  pathname,
  className,
}: {
  groups: NavGroup[];
  pathname: string;
  className?: string;
}) {
  return (
    <ul className={className}>
      {groups.map((group) => (
        <li key={group.heading || "items"} className="flex flex-col gap-1">
          {group.heading ? (
            <p className="px-2 pt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.heading}
            </p>
          ) : null}
          {group.items.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <NavigationMenuLink key={link.href} asChild active={active}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </NavigationMenuLink>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <NavigationMenu className="hidden xl:flex" viewport>
      <NavigationMenuList className="gap-0">
        {primaryNav.map((item) => {
          if (item.type === "link") {
            const active = isActivePath(pathname, item.href);
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink
                  asChild
                  active={active}
                  className={desktopTriggerClass}
                >
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          }

          const clusterActive = isClusterActive(pathname, item);
          const mega = item.groups.length > 1;

          return (
            <NavigationMenuItem key={item.label}>
              <NavigationMenuTrigger
                className={desktopTriggerClass}
                data-active={clusterActive || undefined}
              >
                {item.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ClusterLinks
                  groups={item.groups}
                  pathname={pathname}
                  className={
                    mega
                      ? "grid w-[36rem] grid-cols-3 gap-2 p-2"
                      : "grid w-56 gap-1 p-1"
                  }
                />
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function MobileLink({
  href,
  children,
  pathname,
  nested = false,
}: {
  href: string;
  children: ReactNode;
  pathname: string;
  nested?: boolean;
}) {
  const active = isActivePath(pathname, href);
  return (
    <SheetClose asChild>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex rounded-lg text-sm hover:bg-muted",
          nested
            ? "px-3 py-1.5 text-muted-foreground hover:text-foreground"
            : "px-3 py-2 font-medium",
          active && "bg-muted text-foreground",
        )}
      >
        {children}
      </Link>
    </SheetClose>
  );
}

export function MobileNav({
  signedIn = false,
  staff = false,
}: {
  signedIn?: boolean;
  staff?: boolean;
}) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-label="Open menu"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading">EduVoq</SheetTitle>
          <SheetDescription>Connecting Educators</SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {primaryNav.map((item) => {
              if (item.type === "link") {
                return (
                  <li key={item.href}>
                    <MobileLink href={item.href} pathname={pathname}>
                      {item.label}
                    </MobileLink>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
                      {item.label}
                      <ChevronDownIcon className="size-4 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <ul className="mt-1 mb-2 ml-2 flex flex-col border-l border-border pl-2">
                      {item.groups.map((group) => (
                        <li key={group.heading || "items"}>
                          {group.heading ? (
                            <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              {group.heading}
                            </p>
                          ) : null}
                          <ul className="flex flex-col">
                            {group.items.map((link) => (
                              <li key={link.href}>
                                <MobileLink
                                  href={link.href}
                                  pathname={pathname}
                                  nested
                                >
                                  {link.label}
                                </MobileLink>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </nav>
        <SheetFooter className="border-t sm:flex-row">
          {signedIn ? (
            <>
              <Button variant="outline" className="flex-1" asChild>
                <SheetClose asChild>
                  <Link href="/cart">Cart</Link>
                </SheetClose>
              </Button>
              {staff ? (
                <Button variant="outline" className="flex-1" asChild>
                  <SheetClose asChild>
                    <Link href="/admin">Admin</Link>
                  </SheetClose>
                </Button>
              ) : null}
              <Button variant="outline" className="flex-1" asChild>
                <SheetClose asChild>
                  <Link href="/account/notifications">Alerts</Link>
                </SheetClose>
              </Button>
              <Button className="flex-1" asChild>
                <SheetClose asChild>
                  <Link href="/account">Account</Link>
                </SheetClose>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" asChild>
                <SheetClose asChild>
                  <Link href={authLinks[0].href}>{authLinks[0].label}</Link>
                </SheetClose>
              </Button>
              <Button className="flex-1" asChild>
                <SheetClose asChild>
                  <Link href={authLinks[1].href}>{authLinks[1].label}</Link>
                </SheetClose>
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
