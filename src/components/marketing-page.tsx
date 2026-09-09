import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MarketingPage({
  title,
  description,
  children,
  className,
  image,
  images,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  image?: { src: string; alt: string };
  images?: string[];
}) {
  const gallery = images?.length
    ? images
    : image
      ? [image.src]
      : [];

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8",
        className,
      )}
    >
      {gallery.length > 0 ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {gallery.slice(0, 4).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-auto max-h-80 w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : null}
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
