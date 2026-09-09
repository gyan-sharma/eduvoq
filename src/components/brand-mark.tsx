import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.png"
        alt=""
        width={239}
        height={84}
        className="h-9 w-auto object-contain sm:h-10"
      />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-base font-semibold tracking-tight">
          {SITE_NAME}
        </span>
        {showTagline ? (
          <span className="mt-0.5 hidden text-[0.65rem] tracking-wide text-muted-foreground uppercase sm:block">
            {SITE_TAGLINE}
          </span>
        ) : null}
      </span>
    </span>
  );
}
