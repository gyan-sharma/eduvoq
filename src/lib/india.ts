export const INDIA_COUNTRY = "IN";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

const STATE_SET = new Set<string>(INDIAN_STATES);

export const INDIAN_PIN_RE = /^[1-9][0-9]{5}$/;
export const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const INDIAN_MOBILE_RE = /^(?:\+91[\s-]?|91[\s-]?|0)?[6-9][0-9]{9}$/;

export function isIndiaCountry(country: string): boolean {
  const value = country.trim().toUpperCase();
  return value === "IN" || value === "IND" || value === "INDIA";
}

export function isIndianState(state: string): state is IndianState {
  return STATE_SET.has(state.trim());
}

export function isIndianPin(postalCode: string): boolean {
  return INDIAN_PIN_RE.test(postalCode.trim());
}

export function isGstin(value: string): boolean {
  return GSTIN_RE.test(value.trim().toUpperCase());
}

export function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/[\s-]/g, "");
  const stripped = digits.replace(/^\+?91/, "").replace(/^0/, "");
  if (!/^[6-9][0-9]{9}$/.test(stripped)) return null;
  return stripped;
}
