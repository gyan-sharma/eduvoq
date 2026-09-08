import { textFromTipTap } from "@/lib/tiptap-text";
import { cn } from "@/lib/utils";

export function BodyText({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  const text = textFromTipTap(value);
  if (!text) return null;

  return (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      {text.split("\n").map((line, index) => (
        <p key={index} className="mt-2 whitespace-pre-wrap first:mt-0">
          {line}
        </p>
      ))}
    </div>
  );
}
