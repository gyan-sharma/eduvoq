import { describe, expect, it } from "vitest";
import { isGstin, isIndiaCountry, isIndianPin, normalizeIndianPhone } from "@/lib/india";
import { orderTotals } from "@/lib/money";
import { shippingBand } from "@/lib/shipping";
import {
  GST_TAX_PAISE,
  canDecrementStock,
  isPlaceholderCatalogKey,
  nextStock,
} from "@/lib/types/commerce";
import { addressSchema } from "@/lib/validators/commerce";

describe("shipping bands", () => {
  it("treats metro PINs as ₹79 band", () => {
    expect(shippingBand({ city: "Lucknow", postalCode: "110001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "400001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "560001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "600001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "700001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "500001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "411001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "122001" })).toBe("metro");
    expect(shippingBand({ city: "x", postalCode: "201301" })).toBe("metro");
  });

  it("falls back to city names when PIN is not metro", () => {
    expect(shippingBand({ city: "Bengaluru", postalCode: "226001" })).toBe("metro");
    expect(shippingBand({ city: "New Delhi", postalCode: "226001" })).toBe("metro");
    expect(shippingBand({ city: "Pune", postalCode: "226001" })).toBe("metro");
  });

  it("uses rest of India otherwise", () => {
    expect(shippingBand({ city: "Lucknow", postalCode: "226001" })).toBe(
      "rest_of_india",
    );
    expect(shippingBand({ city: "Jaipur", postalCode: "302001" })).toBe(
      "rest_of_india",
    );
  });

  it("treats an address as metro if PIN or city matches", () => {
    expect(shippingBand({ city: "Mumbai", postalCode: "226001" })).toBe("metro");
    expect(shippingBand({ city: "Lucknow", postalCode: "400001" })).toBe("metro");
  });
});

describe("India address rules", () => {
  it("accepts a Delhi address", () => {
    const parsed = addressSchema.safeParse({
      name: "Asha Sharma",
      line1: "12 MG Road",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110001",
      country: "IN",
      phone: "9876543210",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-India country and bad PIN", () => {
    expect(isIndiaCountry("US")).toBe(false);
    expect(isIndianPin("000001")).toBe(false);
    expect(isIndianPin("110001")).toBe(true);
    const parsed = addressSchema.safeParse({
      name: "Asha",
      line1: "1 Main",
      city: "Boston",
      state: "Delhi",
      postalCode: "02108",
      country: "US",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates GSTIN and Indian mobile", () => {
    expect(isGstin("07ABCDE1234F1Z5")).toBe(true);
    expect(isGstin("GST")).toBe(false);
    expect(normalizeIndianPhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
  });
});

describe("stock and GST", () => {
  it("decrements finite stock and leaves unlimited stock null", () => {
    expect(canDecrementStock(2, 2)).toBe(true);
    expect(canDecrementStock(1, 2)).toBe(false);
    expect(canDecrementStock(null, 5)).toBe(true);
    expect(nextStock(5, 2)).toBe(3);
    expect(nextStock(null, 2)).toBeNull();
  });

  it("keeps GST at 0 on order totals", () => {
    const totals = orderTotals({
      lines: [
        { qty: 1, unitPaise: 18800 },
        { qty: 2, unitPaise: 30000 },
      ],
      shippingPaise: 7900,
      taxPaise: GST_TAX_PAISE,
    });
    expect(GST_TAX_PAISE).toBe(0);
    expect(totals.taxPaise).toBe(0);
    expect(totals.subtotalPaise).toBe(78800);
    expect(totals.totalPaise).toBe(86700);
  });

  it("rejects Wix placeholder SKUs", () => {
    expect(isPlaceholderCatalogKey("i-m-a-product-2")).toBe(true);
    expect(isPlaceholderCatalogKey("EV-DIARY-001")).toBe(false);
  });
});
