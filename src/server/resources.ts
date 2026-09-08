import {
  Board,
  ResourceKind,
  ResourceStatus,
  Role,
  type User,
} from "@prisma/client";
import { newId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { prisma } from "@/server/db";

export type ResourceListItem = {
  id: string;
  slug: string;
  title: string;
  kind: ResourceKind;
  status: ResourceStatus;
  board: Board | null;
  classLevel: string | null;
  subject: string | null;
  createdAt: string;
  fileId: string;
  mimeType: string;
  byteSize: number;
};

export async function listResources(args: {
  kinds: ResourceKind[];
  board?: Board;
  classLevel?: string;
  subject?: string;
  viewer?: User | null;
  publicOnly?: boolean;
}): Promise<ResourceListItem[]> {
  const { kinds, board, classLevel, subject, viewer, publicOnly } = args;

  const statusFilter = publicOnly
    ? { status: ResourceStatus.PUBLISHED }
    : viewer && (viewer.role === Role.STAFF || viewer.role === Role.ADMIN)
      ? { status: { in: [ResourceStatus.PUBLISHED, ResourceStatus.IN_REVIEW] } }
      : viewer
        ? {
            OR: [
              { status: ResourceStatus.PUBLISHED },
              {
                status: ResourceStatus.IN_REVIEW,
                uploadedById: viewer.id,
              },
            ],
          }
        : { status: ResourceStatus.PUBLISHED };

  const rows = await prisma.resource.findMany({
    where: {
      kind: { in: kinds },
      ...statusFilter,
      ...(board ? { board } : {}),
      ...(classLevel ? { classLevel } : {}),
      ...(subject
        ? { subject: { contains: subject } }
        : {}),
    },
    include: {
      file: { select: { id: true, mimeType: true, byteSize: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    status: row.status,
    board: row.board,
    classLevel: row.classLevel,
    subject: row.subject,
    createdAt: row.createdAt.toISOString(),
    fileId: row.file.id,
    mimeType: row.file.mimeType,
    byteSize: row.file.byteSize,
  }));
}

export async function uniqueResourceSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await prisma.resource.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  return `${base}-${newId().slice(0, 8)}`;
}
