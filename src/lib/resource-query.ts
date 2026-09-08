import { CLASS_LEVELS, parseBoard } from "@/lib/resource-meta";
import type { Board } from "@prisma/client";

export type ResourceSearch = {
  board?: string;
  classLevel?: string;
  subject?: string;
};

export function parseResourceSearch(search: ResourceSearch): {
  board?: Board;
  classLevel?: string;
  subject?: string;
} {
  const classLevel = search.classLevel?.trim();
  const subject = search.subject?.trim();
  return {
    board: parseBoard(search.board),
    classLevel:
      classLevel && (CLASS_LEVELS as readonly string[]).includes(classLevel)
        ? classLevel
        : undefined,
    subject: subject || undefined,
  };
}
