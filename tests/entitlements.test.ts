import {
  FileAcl,
  FileOwnerType,
  ResourceStatus,
  ResourceVisibility,
  Role,
  UserStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  authorizeFileAccess,
  hasEducatorLibraryAccess,
} from "@/lib/entitlements";

const educator = {
  id: "u-edu",
  role: Role.EDUCATOR,
  status: UserStatus.ACTIVE,
};

const parent = {
  id: "u-par",
  role: Role.PARENT,
  status: UserStatus.ACTIVE,
};

const file = {
  acl: FileAcl.PRIVATE,
  uploadedById: "u-edu",
  ownerType: FileOwnerType.RESOURCE,
};

const published = {
  status: ResourceStatus.PUBLISHED,
  visibility: ResourceVisibility.EDUCATOR_ONLY,
  uploadedById: "u-edu",
};

describe("hasEducatorLibraryAccess", () => {
  it("allows active educator/expert/staff/admin only", () => {
    expect(hasEducatorLibraryAccess(educator)).toBe(true);
    expect(
      hasEducatorLibraryAccess({
        id: "x",
        role: Role.EXPERT,
        status: UserStatus.ACTIVE,
      }),
    ).toBe(true);
    expect(hasEducatorLibraryAccess(parent)).toBe(false);
    expect(
      hasEducatorLibraryAccess({
        ...educator,
        status: UserStatus.PENDING_VERIFICATION,
      }),
    ).toBe(false);
    expect(hasEducatorLibraryAccess(null)).toBe(false);
  });
});

describe("authorizeFileAccess", () => {
  it("allows public ACL without a session", () => {
    expect(
      authorizeFileAccess({
        file: { ...file, acl: FileAcl.PUBLIC, ownerType: FileOwnerType.PRODUCT },
        resource: null,
        user: null,
      }),
    ).toBe("allow");
  });

  it("sends anonymous EDUCATOR_ONLY downloads to login", () => {
    expect(
      authorizeFileAccess({ file, resource: published, user: null }),
    ).toBe("login");
  });

  it("allows an active educator and forbids a parent", () => {
    expect(
      authorizeFileAccess({ file, resource: published, user: educator }),
    ).toBe("allow");
    expect(
      authorizeFileAccess({ file, resource: published, user: parent }),
    ).toBe("forbidden");
  });

  it("hides unpublished files from other members", () => {
    const inReview = {
      ...published,
      status: ResourceStatus.IN_REVIEW,
    };
    expect(
      authorizeFileAccess({
        file,
        resource: inReview,
        user: { id: "other", role: Role.EDUCATOR, status: UserStatus.ACTIVE },
      }),
    ).toBe("not_found");
    expect(
      authorizeFileAccess({ file, resource: inReview, user: educator }),
    ).toBe("allow");
    expect(
      authorizeFileAccess({
        file,
        resource: inReview,
        user: { id: "staff", role: Role.STAFF, status: UserStatus.ACTIVE },
      }),
    ).toBe("allow");
  });

  it("allows PUBLIC visibility without login", () => {
    expect(
      authorizeFileAccess({
        file,
        resource: { ...published, visibility: ResourceVisibility.PUBLIC },
        user: null,
      }),
    ).toBe("allow");
  });

  it("does not treat FileAcl.PUBLIC as a resource entitlement bypass", () => {
    const publicAcl = { ...file, acl: FileAcl.PUBLIC };
    expect(
      authorizeFileAccess({
        file: publicAcl,
        resource: published,
        user: null,
      }),
    ).toBe("login");
    expect(
      authorizeFileAccess({
        file: publicAcl,
        resource: published,
        user: parent,
      }),
    ).toBe("forbidden");
    expect(
      authorizeFileAccess({
        file: publicAcl,
        resource: published,
        user: educator,
      }),
    ).toBe("allow");
    expect(
      authorizeFileAccess({
        file: publicAcl,
        resource: { ...published, status: ResourceStatus.IN_REVIEW },
        user: { id: "other", role: Role.EDUCATOR, status: UserStatus.ACTIVE },
      }),
    ).toBe("not_found");
  });
});
