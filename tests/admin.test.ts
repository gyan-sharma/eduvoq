import {
  BookingStatus,
  OrderStatus,
  PostStatus,
  ResourceStatus,
  Role,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canArchivePost,
  canBanUser,
  canGrantExpertRole,
  canPublishPost,
  canPublishResource,
  canRejectPost,
  canRevokeExpertRole,
  canSetFeatureFlag,
  cmsPublicPath,
  nextFulfillmentStatus,
  shouldDeleteBookingToFreeSlot,
} from "@/lib/admin-policy";
import { FLAG_DEFAULTS, FLAG_KEYS } from "@/lib/flags";
import { parseTipTapDoc, textFromTipTap } from "@/content/tiptap";

describe("admin policy", () => {
  const admin = { id: "a1", role: Role.ADMIN };
  const staff = { id: "s1", role: Role.STAFF };

  it("lets staff ban educators but not admins", () => {
    expect(canBanUser(staff, { id: "u1", role: Role.EDUCATOR })).toBeNull();
    expect(canBanUser(staff, { id: "a1", role: Role.ADMIN })).toMatch(/admin/i);
    expect(canBanUser(admin, { id: "a1", role: Role.ADMIN })).toMatch(/own/);
  });

  it("reserves EXPERT grants for admins on educator accounts", () => {
    expect(canGrantExpertRole(staff, { role: Role.EDUCATOR })).toMatch(/admins/i);
    expect(canGrantExpertRole(admin, { role: Role.EDUCATOR })).toBeNull();
    expect(canGrantExpertRole(admin, { role: Role.STUDENT })).toMatch(/Student/);
    expect(canGrantExpertRole(admin, { role: Role.EXPERT })).toMatch(/already/);
    expect(canRevokeExpertRole(admin, { role: Role.EXPERT })).toBeNull();
    expect(canRevokeExpertRole(staff, { role: Role.EXPERT })).toMatch(/admins/i);
  });

  it("only lets admins flip flags", () => {
    expect(canSetFeatureFlag(admin)).toBeNull();
    expect(canSetFeatureFlag(staff)).toMatch(/admins/i);
  });

  it("advances order fulfillment PAID → FULFILLING → SHIPPED → DELIVERED", () => {
    expect(nextFulfillmentStatus(OrderStatus.PENDING_PAYMENT)).toBeNull();
    expect(nextFulfillmentStatus(OrderStatus.PAID)).toBe(OrderStatus.FULFILLING);
    expect(nextFulfillmentStatus(OrderStatus.FULFILLING)).toBe(OrderStatus.SHIPPED);
    expect(nextFulfillmentStatus(OrderStatus.SHIPPED)).toBe(OrderStatus.DELIVERED);
    expect(nextFulfillmentStatus(OrderStatus.DELIVERED)).toBeNull();
  });

  it("publishes IN_REVIEW posts and resources", () => {
    expect(canPublishPost(PostStatus.IN_REVIEW)).toBe(true);
    expect(canRejectPost(PostStatus.IN_REVIEW)).toBe(true);
    expect(canPublishPost(PostStatus.PUBLISHED)).toBe(false);
    expect(canArchivePost(PostStatus.PUBLISHED)).toBe(true);
    expect(canArchivePost(PostStatus.IN_REVIEW)).toBe(false);
    expect(canPublishResource(ResourceStatus.IN_REVIEW)).toBe(true);
    expect(canPublishResource(ResourceStatus.PUBLISHED)).toBe(false);
  });

  it("deletes pending and confirmed bookings so the slot unique key is freed", () => {
    expect(shouldDeleteBookingToFreeSlot(BookingStatus.PENDING_PAYMENT)).toBe(
      true,
    );
    expect(shouldDeleteBookingToFreeSlot(BookingStatus.CONFIRMED)).toBe(true);
    expect(shouldDeleteBookingToFreeSlot(BookingStatus.NO_SHOW)).toBe(false);
    expect(shouldDeleteBookingToFreeSlot(BookingStatus.COMPLETED)).toBe(false);
  });

  it("maps CMS slugs to public paths", () => {
    expect(cmsPublicPath("about")).toBe("/about");
    expect(cmsPublicPath("services/marketing")).toBe("/services/marketing");
  });
});

describe("flags catalog", () => {
  it("includes events_registration and commerce_physical defaults", () => {
    expect(FLAG_KEYS).toContain("events_registration");
    expect(FLAG_DEFAULTS.events_registration).toBe(true);
    expect(FLAG_DEFAULTS.commerce_physical).toBe(true);
    expect(FLAG_DEFAULTS.wallet_spend).toBe(false);
  });
});

describe("TipTap JSON", () => {
  it("parses a doc and rejects garbage", () => {
    const doc = parseTipTapDoc(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      }),
    );
    expect(doc?.type).toBe("doc");
    expect(textFromTipTap(doc)).toBe("Hello");
    expect(parseTipTapDoc("not json")).toBeNull();
    expect(parseTipTapDoc({ type: "paragraph" })).toBeNull();
  });
});
