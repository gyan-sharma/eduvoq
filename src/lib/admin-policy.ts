import {
  OrderStatus,
  PostStatus,
  ResourceStatus,
  Role,
} from "@prisma/client";

export function canBanUser(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
): string | null {
  if (actor.id === target.id) return "You cannot ban your own account.";
  if (actor.role !== Role.ADMIN && actor.role !== Role.STAFF) {
    return "Not allowed.";
  }
  if (target.role === Role.ADMIN && actor.role !== Role.ADMIN) {
    return "Staff cannot ban an admin.";
  }
  if (target.role === Role.STAFF && actor.role !== Role.ADMIN) {
    return "Staff cannot ban other staff.";
  }
  return null;
}

export function canGrantExpertRole(
  actor: { role: Role },
  target: { role: Role },
): string | null {
  if (actor.role !== Role.ADMIN) {
    return "Only admins can grant the expert role.";
  }
  if (target.role === Role.ADMIN || target.role === Role.STAFF) {
    return "Cannot change an admin or staff role.";
  }
  if (target.role === Role.STUDENT) {
    return "Student accounts cannot become experts.";
  }
  if (target.role === Role.EXPERT) {
    return "This user is already an expert.";
  }
  if (target.role !== Role.EDUCATOR) {
    return "Only educator accounts can be granted the expert role.";
  }
  return null;
}

export function canRevokeExpertRole(
  actor: { role: Role },
  target: { role: Role },
): string | null {
  if (actor.role !== Role.ADMIN) {
    return "Only admins can change the expert role.";
  }
  if (target.role !== Role.EXPERT) return "This user is not an expert.";
  return null;
}

export function canSetFeatureFlag(actor: { role: Role }): string | null {
  if (actor.role !== Role.ADMIN) {
    return "Only admins can change feature flags.";
  }
  return null;
}

export function nextFulfillmentStatus(
  status: OrderStatus,
): OrderStatus | null {
  switch (status) {
    case OrderStatus.PAID:
      return OrderStatus.FULFILLING;
    case OrderStatus.FULFILLING:
      return OrderStatus.SHIPPED;
    case OrderStatus.SHIPPED:
      return OrderStatus.DELIVERED;
    default:
      return null;
  }
}

export function fulfillmentLabel(status: OrderStatus): string | null {
  switch (nextFulfillmentStatus(status)) {
    case OrderStatus.FULFILLING:
      return "Mark fulfilling";
    case OrderStatus.SHIPPED:
      return "Mark shipped";
    case OrderStatus.DELIVERED:
      return "Mark delivered";
    default:
      return null;
  }
}

export function canPublishPost(status: PostStatus): boolean {
  return (
    status === PostStatus.IN_REVIEW ||
    status === PostStatus.DRAFT ||
    status === PostStatus.REJECTED
  );
}

export function canRejectPost(status: PostStatus): boolean {
  return status === PostStatus.IN_REVIEW || status === PostStatus.DRAFT;
}

export function canPublishResource(status: ResourceStatus): boolean {
  return (
    status === ResourceStatus.IN_REVIEW || status === ResourceStatus.REJECTED
  );
}

export function cmsPublicPath(slug: string): string {
  return slug.startsWith("/") ? slug : `/${slug}`;
}
