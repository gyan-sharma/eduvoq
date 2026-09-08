import {
  FileAcl,
  FileOwnerType,
  ResourceStatus,
  ResourceVisibility,
  Role,
  UserStatus,
} from "@prisma/client";

/** v1 EDUCATOR_ONLY library — paid webinar pack does not grant this. */
export const EDUCATOR_LIBRARY_ROLES: readonly Role[] = [
  Role.EDUCATOR,
  Role.EXPERT,
  Role.STAFF,
  Role.ADMIN,
];

export type EntitlementUser = {
  id: string;
  role: Role;
  status: UserStatus;
};

export function hasEducatorLibraryAccess(
  user: EntitlementUser | null | undefined,
): boolean {
  if (!user) return false;
  if (user.status !== UserStatus.ACTIVE) return false;
  return EDUCATOR_LIBRARY_ROLES.includes(user.role);
}

export function canUploadResource(user: EntitlementUser | null | undefined): boolean {
  return hasEducatorLibraryAccess(user);
}

export type FileAccessDecision = "allow" | "login" | "forbidden" | "not_found";

export function authorizeFileAccess(args: {
  file: { acl: FileAcl; uploadedById: string; ownerType: FileOwnerType };
  resource: {
    status: ResourceStatus;
    visibility: ResourceVisibility;
    uploadedById: string;
  } | null;
  user: EntitlementUser | null;
}): FileAccessDecision {
  const { file, resource, user } = args;

  // Resource rows always use status + visibility. FileAcl.PUBLIC must not
  // publish an IN_REVIEW or EDUCATOR_ONLY PDF.
  if (file.ownerType === FileOwnerType.RESOURCE) {
    if (!resource) return "not_found";

    if (resource.status !== ResourceStatus.PUBLISHED) {
      if (!user) return "login";
      if (user.role === Role.STAFF || user.role === Role.ADMIN) return "allow";
      if (user.id === resource.uploadedById && user.status === UserStatus.ACTIVE) {
        return "allow";
      }
      return "not_found";
    }

    if (resource.visibility === ResourceVisibility.PUBLIC) {
      return "allow";
    }

    if (resource.visibility === ResourceVisibility.EDUCATOR_ONLY) {
      if (!user) return "login";
      if (hasEducatorLibraryAccess(user)) return "allow";
      return "forbidden";
    }

    // SUBSCRIBER is unused in v1.
    if (!user) return "login";
    return "forbidden";
  }

  if (file.acl === FileAcl.PUBLIC) {
    return "allow";
  }

  if (!user) return "login";
  if (user.id === file.uploadedById) return "allow";
  if (user.role === Role.STAFF || user.role === Role.ADMIN) return "allow";
  return "forbidden";
}
