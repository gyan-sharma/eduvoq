import { Role, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canFollowUser,
  canSetOwnProfilePublic,
  canViewProfile,
  directoryWhere,
  firstName,
  followNotificationHref,
  isDirectoryRole,
  isStudentPublicCard,
  isUsernameChangeLocked,
  replaceFirstName,
  toPublicMemberCard,
  USERNAME_CHANGE_WINDOW_MS,
} from "@/lib/profile-privacy";

const adult = {
  id: "edu-1",
  role: Role.EDUCATOR,
  status: UserStatus.ACTIVE,
  parentId: null,
  isProfilePublic: true,
};

const student = {
  id: "stu-1",
  role: Role.STUDENT,
  status: UserStatus.ACTIVE,
  parentId: "par-1",
  isProfilePublic: false,
};

const parent = {
  id: "par-1",
  role: Role.PARENT,
  status: UserStatus.ACTIVE,
  parentId: null,
  isProfilePublic: true,
};

describe("directory listing", () => {
  it("includes only educator-like roles", () => {
    expect(isDirectoryRole(Role.EDUCATOR)).toBe(true);
    expect(isDirectoryRole(Role.EXPERT)).toBe(true);
    expect(isDirectoryRole(Role.STAFF)).toBe(true);
    expect(isDirectoryRole(Role.ADMIN)).toBe(true);
    expect(isDirectoryRole(Role.STUDENT)).toBe(false);
    expect(isDirectoryRole(Role.PARENT)).toBe(false);
    expect(directoryWhere().role.in).toEqual([
      Role.EDUCATOR,
      Role.EXPERT,
      Role.STAFF,
      Role.ADMIN,
    ]);
  });
});

describe("student public card", () => {
  it("uses first name only and strips school, photo, and location", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
    const card = toPublicMemberCard(
      {
        id: student.id,
        username: "ada",
        name: "Ada Lovelace",
        role: Role.STUDENT,
        headline: "should hide",
        image: "https://example.com/photo.jpg",
        city: "Delhi",
        state: "Delhi",
        boardAffiliation: null,
        schoolName: "Secret School",
        bio: "private",
        subjects: ["Math"],
        classesTaught: ["Class 6"],
        linkedinUrl: "https://www.linkedin.com/in/hidden",
        parentId: student.parentId,
      },
      null,
    );
    expect(card).toMatchObject({
      displayName: "Ada",
      headline: "Class 6",
      avatarUrl: null,
      schoolName: null,
      city: null,
      bio: null,
      linkedinUrl: null,
      restricted: true,
    });
  });

  it("lets a parent see the full name", () => {
    expect(isStudentPublicCard(student, parent)).toBe(false);
    const card = toPublicMemberCard(
      {
        id: student.id,
        username: "ada",
        name: "Ada Lovelace",
        role: Role.STUDENT,
        headline: null,
        image: null,
        city: null,
        state: null,
        boardAffiliation: null,
        schoolName: null,
        bio: null,
        subjects: [],
        classesTaught: ["Class 6"],
        linkedinUrl: null,
        parentId: student.parentId,
      },
      parent,
    );
    expect(card?.displayName).toBe("Ada Lovelace");
    expect(card?.restricted).toBe(false);
  });

  it("hides unpublished student profiles from the public", () => {
    expect(canViewProfile(student, null)).toBe(false);
    expect(canViewProfile({ ...student, isProfilePublic: true }, null)).toBe(
      true,
    );
    expect(canViewProfile(student, parent)).toBe(true);
  });
});

describe("follow rules", () => {
  it("blocks students from following arbitrary adults", () => {
    const result = canFollowUser(student, adult);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/cannot follow arbitrary adults/i);
    }
  });

  it("allows a student to follow their parent even if the parent is hidden", () => {
    expect(canFollowUser(student, parent).ok).toBe(true);
    expect(
      canFollowUser(student, { ...parent, isProfilePublic: false }).ok,
    ).toBe(true);
  });

  it("does not let a student follow some other hidden parent", () => {
    expect(
      canFollowUser(student, {
        ...parent,
        id: "par-2",
        isProfilePublic: false,
      }).ok,
    ).toBe(false);
  });

  it("allows a student to follow an opted-in student", () => {
    expect(
      canFollowUser(student, { ...student, id: "stu-2", isProfilePublic: true })
        .ok,
    ).toBe(true);
  });

  it("allows educators to follow public educators", () => {
    expect(canFollowUser(adult, { ...adult, id: "edu-2" }).ok).toBe(true);
  });

  it("does not allow following a hidden student except the parent", () => {
    expect(canFollowUser(adult, student).ok).toBe(false);
    expect(canFollowUser(parent, student).ok).toBe(true);
  });
});

describe("username lock", () => {
  it("locks after 14 days from createdAt when never changed", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    expect(
      isUsernameChangeLocked(
        { usernameChangedAt: null, createdAt },
        new Date("2026-01-10T00:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isUsernameChangeLocked(
        { usernameChangedAt: null, createdAt },
        new Date(createdAt.getTime() + USERNAME_CHANGE_WINDOW_MS),
      ),
    ).toBe(true);
  });
});

describe("student public-card opt-in", () => {
  it("is parent-only; students cannot set isProfilePublic themselves", () => {
    expect(canSetOwnProfilePublic(Role.STUDENT)).toBe(false);
    expect(canSetOwnProfilePublic(Role.PARENT)).toBe(true);
    expect(canSetOwnProfilePublic(Role.EDUCATOR)).toBe(true);
  });
});

describe("follow notification href", () => {
  it("omits /members/{username} when the recipient cannot view the actor", () => {
    const hiddenStudent = {
      ...student,
      username: "ada",
    };
    const publicStudent = {
      ...student,
      id: "stu-2",
      username: "bea",
      isProfilePublic: true,
      parentId: "par-2",
    };
    expect(followNotificationHref(hiddenStudent, publicStudent)).toBeNull();
    expect(followNotificationHref(hiddenStudent, parent)).toBe("/members/ada");
    expect(followNotificationHref(publicStudent, adult)).toBe("/members/bea");
  });
});

describe("replaceFirstName", () => {
  it("keeps a privately stored last name", () => {
    expect(replaceFirstName("Ada Lovelace", "Adah")).toBe("Adah Lovelace");
    expect(replaceFirstName("Ada", "Bea")).toBe("Bea");
  });
});
