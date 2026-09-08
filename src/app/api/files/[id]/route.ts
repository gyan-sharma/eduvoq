import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { authorizeFileAccess } from "@/lib/entitlements";
import { isAllowedMime } from "@/lib/storage/limits";
import { getStorage, StorageNotFoundError } from "@/lib/storage";
import { objectKeyFilename } from "@/lib/storage/object-key";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function contentDisposition(filename: string, inline: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(filename);
  const type = inline ? "inline" : "attachment";
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await prisma.fileObject.findUnique({
    where: { id },
    include: { resourceAsFile: true },
  });
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isAllowedMime(file.mimeType)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const session = await auth();
  let user = null;
  if (session?.user?.id) {
    user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && user.tokenVersion !== (session.user.tokenVersion ?? 0)) {
      user = null;
    }
    if (
      user &&
      (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED)
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (user?.status === UserStatus.PENDING_PROFILE) {
      return NextResponse.redirect(new URL("/complete-profile", req.url));
    }
  }

  const decision = authorizeFileAccess({
    file,
    resource: file.resourceAsFile,
    user,
  });

  if (decision === "not_found") {
    return new NextResponse("Not found", { status: 404 });
  }
  if (decision === "login") {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", `/api/files/${id}`);
    return NextResponse.redirect(url);
  }
  if (decision === "forbidden") {
    return new NextResponse(
      "This file is for verified educators. The webinar pack does not unlock Resource Corner.",
      { status: 403 },
    );
  }

  if (file.resourceAsFile && user) {
    await prisma.resourceDownload.create({
      data: { resourceId: file.resourceAsFile.id, userId: user.id },
    });
  }

  const filename = objectKeyFilename(file.objectKey);
  const publiclyServed =
    authorizeFileAccess({
      file,
      resource: file.resourceAsFile,
      user: null,
    }) === "allow";
  const inline = publiclyServed && file.mimeType.startsWith("image/");
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Length": String(file.byteSize),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Frame-Options": "DENY",
    "Cache-Control": publiclyServed
      ? "public, max-age=86400"
      : "private, no-store",
    "Content-Disposition": contentDisposition(filename, inline),
  });

  // Always stream through this handler. Never 302 to a MinIO/S3 presign —
  // PRIVATE/EDUCATOR_ONLY PDFs must not get a world-fetchable object URL,
  // and the attachment/nosniff/CSP headers have to stay on the response.
  try {
    const stream = await getStorage().getStream(file.objectKey);
    return new Response(stream, { status: 200, headers });
  } catch (error) {
    if (error instanceof StorageNotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }
}
