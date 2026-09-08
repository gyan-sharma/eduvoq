import { safeFilenameBase } from "@/lib/storage/object-key";

/** Absolute cap. Images use the smaller image cap. No ClamAV in v1. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

const EXT_FOR_MIME: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function sniffMime(body: Buffer): AllowedMime | null {
  if (body.length >= 5 && body.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (body.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46) {
    return "application/pdf";
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString("latin1") === "RIFF" &&
    body.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function maxBytesForMime(mime: AllowedMime): number {
  return mime === "application/pdf" ? MAX_FILE_BYTES : MAX_IMAGE_BYTES;
}

export type UploadValidation =
  | { ok: true; mime: AllowedMime; filename: string }
  | { ok: false; error: string };

export function validateUpload(body: Buffer, originalName: string): UploadValidation {
  if (!body.length) {
    return { ok: false, error: "The file is empty." };
  }
  if (body.length > MAX_FILE_BYTES) {
    return { ok: false, error: "File is larger than 25 MB." };
  }
  const mime = sniffMime(body);
  if (!mime) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a PDF, JPEG, PNG, or WebP.",
    };
  }
  const cap = maxBytesForMime(mime);
  if (body.length > cap) {
    return {
      ok: false,
      error:
        mime === "application/pdf"
          ? "PDF files cannot exceed 25 MB."
          : "Images cannot exceed 5 MB.",
    };
  }
  const filename = `${safeFilenameBase(originalName)}.${EXT_FOR_MIME[mime]}`;
  return { ok: true, mime, filename };
}

export function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(value);
}
