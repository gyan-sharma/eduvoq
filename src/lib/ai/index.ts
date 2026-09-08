export { getXaiClient } from "@/lib/ai/client";
export {
  getXaiConfig,
  isXaiConfigured,
  XAI_DEFAULT_BASE_URL,
  XAI_DEFAULT_MODEL,
} from "@/lib/ai/config";
export {
  canUseBlogDraftHelper,
  canUseLessonPlanAssistant,
} from "@/lib/ai/access";
export { parseBlogDraft } from "@/lib/ai/blog-draft";
export { completeAiText } from "@/lib/ai/complete";
export {
  getAiAvailability,
  isAiAssistantsEnabled,
  isAiAvailable,
} from "@/lib/ai/enabled";
export { hashAiUserId } from "@/lib/ai/log";
export {
  assertNotStudentContent,
  containsStudentPii,
  isStudentActor,
  privacyBlockReason,
  requestsExamLeak,
  stripStudentPii,
} from "@/lib/ai/privacy";
export {
  BLOG_DRAFT_SYSTEM_PROMPT,
  LESSON_PLAN_SYSTEM_PROMPT,
  buildBlogDraftUserPrompt,
  buildLessonPlanUserPrompt,
} from "@/lib/ai/prompts";
