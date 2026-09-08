import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MarketingPage({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8",
        className,
      )}
    >
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-lg text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </article>
  );
}
