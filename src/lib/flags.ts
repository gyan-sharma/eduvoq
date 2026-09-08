/** Students cannot self-register; only a PARENT may create a STUDENT row. */
export const STUDENT_SELF_REGISTER = false;

export const TOS_VERSION = "1";

/** Unpaid booking/order hold, aligned with Razorpay expire_by and Stripe session expire. */
export const UNPAID_TIMEOUT_MINUTES = 15;

/** DB `FeatureFlag.key` for optional xAI assistants. Default off. */
export const FLAG_AI_ASSISTANTS = "ai_assistants";

/** Env var that enables `ai_assistants` without a DB row. */
export const ENV_AI_ASSISTANTS = "AI_ASSISTANTS";

/** Sample forum, community, groups, and member pages for walkthroughs. */
export const FLAG_DEMO_MODE = "demo_mode";

export const FLAG_DEFAULTS: Record<string, boolean> = {
  registrations: true,
  student_self_register: false,
  community: true,
  forum: true,
  commerce: true,
  commerce_physical: true,
  bookings: true,
  wallet_spend: false,
  ai_assistants: false,
  events_registration: true,
  demo_mode: false,
};

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS);

export const FLAG_LABELS: Record<string, string> = {
  registrations: "Allow new account registrations.",
  student_self_register: "Allow students to create their own accounts.",
  community: "Teacher Social feed.",
  forum: "Public educator forums.",
  commerce: "Store and checkout.",
  commerce_physical: "Physical goods and self-ship.",
  bookings: "Consultation booking.",
  wallet_spend: "Spend wallet balance at checkout.",
  ai_assistants: "Optional xAI blog and lesson-plan helpers.",
  events_registration: "Event registration.",
  demo_mode: "Show sample forum, community, groups, and member pages.",
};

export function parseEnvBool(
  value: string | undefined | null,
): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return undefined;
}
