import { Role, UserStatus } from "@prisma/client";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** 10-digit Indian mobiles, optional +91/0, spaces or hyphens (98765 43210, +91-98765-43210). */
const IN_PHONE_RE = /(?<!\d)(?:\+91[\s-]*|0)?[6-9](?:[\s-]*\d){9}(?!\d)/g;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const NAMED_OR_CALLED_RE =
  /\b(?:student|child|pupil|ward|daughter|son|kid)s?\s+(?:named?|called)\s+([A-Za-z][A-Za-z'.-]{1,30})(?:\s+([A-Za-z][A-Za-z'.-]{1,30}))?\b/gi;
const KINSHIP_NAME_RE =
  /\b(?:my|our)\s+(?:daughter|son|kid|child|children|ward|student|pupil|grandson|granddaughter|niece|nephew)(?:'s)?\s+([A-Za-z][A-Za-z'.-]{1,30})(?:\s+([A-Za-z][A-Za-z'.-]{1,30}))?\b/gi;

const GIVEN_NAME_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "in",
  "of",
  "on",
  "at",
  "to",
  "for",
  "and",
  "or",
  "who",
  "that",
  "with",
  "from",
  "was",
  "were",
  "are",
  "be",
  "been",
  "being",
  "has",
  "had",
  "have",
  "this",
  "these",
  "those",
  "class",
  "grade",
  "school",
  "notes",
  "note",
  "about",
  "regarding",
  "my",
  "our",
  "their",
  "his",
  "her",
  "its",
  "will",
  "can",
  "needs",
  "need",
  "help",
  "please",
  "here",
  "there",
  "not",
  "very",
  "so",
  "too",
  "also",
  "all",
  "some",
  "many",
  "few",
  "more",
  "less",
  "into",
  "over",
  "under",
  "after",
  "before",
  "when",
  "while",
  "because",
  "as",
  "if",
  "but",
  "by",
  "up",
  "out",
  "your",
  "you",
  "we",
  "they",
  "them",
  "us",
  "me",
  "he",
  "she",
  "it",
]);

const LEAK_RE =
  /\b(?:leak(?:ed|s)?|stolen|forthcoming|upcoming)\b.{0,40}\b(?:board\s+)?(?:exam|question\s*paper|paper)\b|\b(?:board\s+)?(?:exam|question\s*paper)\b.{0,40}\b(?:leak(?:ed|s)?|stolen)\b/i;

const PII_REFUSAL =
  "Remove student names, phone numbers, emails, and other personal data before using the assistant.";

function isPlausibleGivenName(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[.'-]+/g, "");
  if (normalized.length < 2 || normalized.length > 30) return false;
  if (GIVEN_NAME_STOPWORDS.has(normalized)) return false;
  return /^[a-z]+$/i.test(normalized);
}

function namedChildSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const re of [NAMED_OR_CALLED_RE, KINSHIP_NAME_RE]) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      if (!isPlausibleGivenName(match[1])) continue;
      if (match.index == null) continue;
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
    re.lastIndex = 0;
  }
  return spans;
}

function hasMatch(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  const found = re.test(text);
  re.lastIndex = 0;
  return found;
}

export function containsStudentPii(text: string): boolean {
  return (
    hasMatch(EMAIL_RE, text) ||
    hasMatch(IN_PHONE_RE, text) ||
    hasMatch(AADHAAR_RE, text) ||
    namedChildSpans(text).length > 0
  );
}

export function stripStudentPii(text: string): string {
  let next = text
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(IN_PHONE_RE, "[redacted-phone]")
    .replace(AADHAAR_RE, "[redacted-id]");
  const spans = namedChildSpans(next).sort((a, b) => b.start - a.start);
  for (const span of spans) {
    next = `${next.slice(0, span.start)}[redacted-student]${next.slice(span.end)}`;
  }
  return next;
}

export function requestsExamLeak(text: string): boolean {
  return LEAK_RE.test(text);
}

export type AiActor = {
  role: Role;
  status: UserStatus;
};

export function isStudentActor(actor: AiActor | null | undefined): boolean {
  return actor?.role === Role.STUDENT;
}

/** Refuse child-account content before any model call. */
export function assertNotStudentContent(
  actor: AiActor | null | undefined,
): string | null {
  if (!actor) return "Please log in first.";
  if (actor.role === Role.STUDENT) {
    return "Student accounts cannot use AI assistants.";
  }
  return null;
}

export function privacyBlockReason(text: string): string | null {
  if (requestsExamLeak(text)) {
    return "The assistant cannot generate board-exam leaks or forthcoming papers.";
  }
  if (containsStudentPii(text)) {
    return PII_REFUSAL;
  }
  return null;
}
