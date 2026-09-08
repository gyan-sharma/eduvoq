/** Students cannot self-register; only a PARENT may create a STUDENT row. */
export const STUDENT_SELF_REGISTER = false;

export const TOS_VERSION = "1";

/** Unpaid booking/order hold, aligned with Razorpay order expiry. */
export const UNPAID_TIMEOUT_MINUTES = 15;

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
};

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS);
