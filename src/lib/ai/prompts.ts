export const SHARED_SAFETY_RULES = `Never generate board-exam "leaks", stolen papers, or content that claims to be an authentic forthcoming exam.
Never request, store, or echo student names, emails, phone numbers, addresses, Aadhaar numbers, or other personal data.
Do not write about a named child or class roster. Speak in generic classroom terms ("a learner", "the class").
If the user asks for leaks or personal data, refuse briefly.`;

export const LESSON_PLAN_SYSTEM_PROMPT = `You are EduVoq's lesson-plan assistant for school educators in India (CBSE, ICSE, IB, KVS, state boards).
Write a practical classroom lesson plan in Markdown with these sections:
1. Learning objectives
2. Materials
3. Warm-up
4. Instruction
5. Guided practice
6. Independent practice
7. Assessment
8. Differentiation
Keep it usable in a real period. Do not invent a full board question paper.
${SHARED_SAFETY_RULES}`;

export const BLOG_DRAFT_SYSTEM_PROMPT = `You are EduVoq's blog draft helper for educator-authored articles on https://www.eduvoq.com.
Write in a professional, India-centric education voice. The author will edit before submitting for staff review.
Return JSON only, no markdown fences, with keys:
- "title": string (8–255 characters)
- "excerpt": string (one or two sentences, under 2000 characters)
- "body": string (article in plain paragraphs separated by blank lines, 40–15000 characters)
Do not include student identities or unpublished exam content.
${SHARED_SAFETY_RULES}`;

export type LessonPlanPromptInput = {
  topic: string;
  board?: string;
  classLevel?: string;
  subject?: string;
  durationMinutes?: number;
};

export function buildLessonPlanUserPrompt(input: LessonPlanPromptInput): string {
  const lines = [
    `Topic / learning objective: ${input.topic}`,
    input.board ? `Board: ${input.board}` : null,
    input.classLevel ? `Class: ${input.classLevel}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    input.durationMinutes
      ? `Period length: ${input.durationMinutes} minutes`
      : null,
    "",
    "Write one lesson plan. Do not include any student's name or contact details.",
  ];
  return lines.filter((line): line is string => line != null).join("\n");
}

export type BlogDraftPromptInput = {
  topic: string;
  audience?: string;
  notes?: string;
};

export function buildBlogDraftUserPrompt(input: BlogDraftPromptInput): string {
  const lines = [
    `Topic: ${input.topic}`,
    input.audience ? `Audience: ${input.audience}` : "Audience: school educators in India",
    input.notes ? `Author notes:\n${input.notes}` : null,
    "",
    "Produce a draft article the author can edit. JSON only.",
  ];
  return lines.filter((line): line is string => line != null).join("\n");
}
