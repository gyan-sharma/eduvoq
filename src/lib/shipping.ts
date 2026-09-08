export const SHIPPING_METRO_SLUG = "metro";
export const SHIPPING_REST_SLUG = "rest_of_india";

export const DEFAULT_METRO_PAISE = 7900;
export const DEFAULT_REST_PAISE = 12900;

export type ShippingBand = typeof SHIPPING_METRO_SLUG | typeof SHIPPING_REST_SLUG;

const METRO_CITIES = new Set([
  "delhi",
  "new delhi",
  "noida",
  "greater noida",
  "ghaziabad",
  "gurugram",
  "gurgaon",
  "faridabad",
  "mumbai",
  "navi mumbai",
  "thane",
  "bengaluru",
  "bangalore",
  "chennai",
  "madras",
  "kolkata",
  "calcutta",
  "hyderabad",
  "secunderabad",
  "pune",
  "pimpri chinchwad",
]);

const METRO_PIN_PREFIXES = [
  "110",
  "121",
  "122",
  "201",
  "400",
  "401",
  "410",
  "411",
  "500",
  "560",
  "600",
  "700",
];

export function normalizeCity(city: string): string {
  return city
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isMetroPincode(postalCode: string): boolean {
  const pin = postalCode.trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) return false;
  return METRO_PIN_PREFIXES.some((prefix) => pin.startsWith(prefix));
}

export function isMetroCity(city: string): boolean {
  return METRO_CITIES.has(normalizeCity(city));
}

export function shippingBand(input: {
  city: string;
  postalCode: string;
}): ShippingBand {
  if (isMetroPincode(input.postalCode)) return SHIPPING_METRO_SLUG;
  if (isMetroCity(input.city)) return SHIPPING_METRO_SLUG;
  return SHIPPING_REST_SLUG;
}

export function shippingPaiseForBand(
  band: ShippingBand,
  rates?: { metro: number; rest: number },
): number {
  const metro = rates?.metro ?? DEFAULT_METRO_PAISE;
  const rest = rates?.rest ?? DEFAULT_REST_PAISE;
  return band === SHIPPING_METRO_SLUG ? metro : rest;
}
