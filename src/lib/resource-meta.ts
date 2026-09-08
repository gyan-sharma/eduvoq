import { Board, ResourceKind } from "@prisma/client";

export const BOARD_VALUES = [
  "CBSE",
  "ICSE",
  "IB",
  "STATE_BOARD",
  "KVS",
  "NVS",
  "OTHER",
] as const satisfies readonly Board[];

export const BOARD_LABELS: Record<Board, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  IB: "IB",
  STATE_BOARD: "State board",
  KVS: "Kendriya Vidyalaya",
  NVS: "Navodaya Vidyalaya",
  OTHER: "Other",
};

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  LEARNING_MATERIAL: "Learning material",
  CLASS_NOTES: "Class notes",
  SAMPLE_PAPER: "Sample paper",
  LESSON_PLAN: "Lesson plan",
  SYLLABUS: "Syllabus",
  OTHER: "Other",
};

export const CLASS_LEVELS = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export function classLevelLabel(value: string): string {
  if (/^\d+$/.test(value)) return `Class ${value}`;
  return value;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseBoard(value: string | undefined | null): Board | undefined {
  if (!value) return undefined;
  return (BOARD_VALUES as readonly string[]).includes(value)
    ? (value as Board)
    : undefined;
}
