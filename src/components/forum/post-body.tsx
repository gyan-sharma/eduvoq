import { paragraphsFromDoc } from "@/lib/rich-text";

export function PostBody({ bodyJson }: { bodyJson: unknown }) {
  const paragraphs = paragraphsFromDoc(bodyJson);
  if (paragraphs.length === 0) return null;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {paragraphs.map((text, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {text}
        </p>
      ))}
    </div>
  );
}
