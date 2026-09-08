"use client";

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
  communityLinks,
  primaryLinks,
  serviceGroups,
  serviceLinks,
} from "@/lib/nav";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <NavigationMenu className="hidden xl:flex" viewport>
      <NavigationMenuList className="gap-0.5">
        {primaryLinks.slice(0, 2).map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
              data-active={isActivePath(pathname, item.href) || undefined}
            >
              <Link href={item.href}>{item.label}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}

        <NavigationMenuItem>
          <NavigationMenuTrigger
            data-active={
              isActivePath(pathname, "/services") || undefined
            }
          >
            Services
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[36rem] grid-cols-3 gap-2 p-2">
              {serviceGroups.map((group) => (
                <li key={group.heading} className="flex flex-col gap-1">
                  <p className="px-2 pt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.heading}
                  </p>
                  {group.items.map((item) => (
                    <NavigationMenuLink key={item.href} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </NavigationMenuLink>
                  ))}
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {primaryLinks.slice(2, 5).map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
              data-active={isActivePath(pathname, item.href) || undefined}
            >
              <Link href={item.href}>{item.label}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}

        <NavigationMenuItem>
          <NavigationMenuTrigger
            data-active={
              communityLinks.some((item) => isActivePath(pathname, item.href)) ||
              undefined
            }
          >
            Community
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-56 gap-1 p-1">
              {communityLinks.map((item) => (
                <li key={item.href}>
                  <NavigationMenuLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {primaryLinks.slice(5).map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
              data-active={isActivePath(pathname, item.href) || undefined}
            >
              <Link href={item.href}>{item.label}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function MobileNav() {
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
            {primaryLinks.slice(0, 2).map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted",
                      isActivePath(pathname, item.href) && "bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
            <li>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
                  Services
                  <ChevronDownIcon className="size-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <ul className="mt-1 mb-2 ml-2 flex flex-col border-l border-border pl-2">
                  {serviceLinks.map((item) => (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                            isActivePath(pathname, item.href) &&
                              "bg-muted text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            {primaryLinks.slice(2, 5).map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted",
                      isActivePath(pathname, item.href) && "bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
            <li>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
                  Community
                  <ChevronDownIcon className="size-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <ul className="mt-1 mb-2 ml-2 flex flex-col border-l border-border pl-2">
                  {communityLinks.map((item) => (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                            isActivePath(pathname, item.href) &&
                              "bg-muted text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            {primaryLinks.slice(5).map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted",
                      isActivePath(pathname, item.href) && "bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <SheetFooter className="border-t sm:flex-row">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
