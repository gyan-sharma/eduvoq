import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalDriver } from "@/lib/storage/local";
import { StorageNotFoundError } from "@/lib/storage/errors";
import {
  MAX_FILE_BYTES,
  sniffMime,
  validateUpload,
} from "@/lib/storage/limits";
import {
  assertSafeObjectKey,
  resourceObjectKey,
  safeFilenameBase,
} from "@/lib/storage/object-key";

function pdfBytes(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01, 0x02, 0x03]);
}

function pngBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("rest"),
  ]);
}

describe("MIME sniff + caps", () => {
  it("accepts PDF / JPEG / PNG magic bytes", () => {
    expect(sniffMime(pdfBytes())).toBe("application/pdf");
    expect(sniffMime(jpegBytes())).toBe("image/jpeg");
    expect(sniffMime(pngBytes())).toBe("image/png");
  });

  it("rejects HTML, SVG, and empty bodies", () => {
    expect(sniffMime(Buffer.from("<!doctype html>"))).toBeNull();
    expect(sniffMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(validateUpload(Buffer.from(""), "x.pdf").ok).toBe(false);
  });

  it("enforces 25 MB absolute cap and 5 MB image cap", () => {
    const huge = validateUpload(Buffer.alloc(MAX_FILE_BYTES + 1, 0x25), "x.pdf");
    expect(huge.ok).toBe(false);

    const bigImage = Buffer.concat([jpegBytes(), Buffer.alloc(5 * 1024 * 1024)]);
    const result = validateUpload(bigImage, "photo.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/5 MB/);
  });

  it("rewrites the filename to a safe extension from sniffed type", () => {
    const result = validateUpload(pdfBytes(), "../../etc/passwd.html");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mime).toBe("application/pdf");
      expect(result.filename).toBe("passwd.pdf");
    }
  });
});

describe("object keys", () => {
  it("rejects path traversal", () => {
    expect(() => assertSafeObjectKey("private/../secret")).toThrow(/Invalid/);
    expect(() => assertSafeObjectKey("/etc/passwd")).toThrow(/Invalid/);
    expect(() => assertSafeObjectKey("private//x")).toThrow(/Invalid/);
    expect(() => resourceObjectKey("abc", "../x.pdf")).toThrow(/Invalid/);
  });

  it("builds a private resource key", () => {
    expect(resourceObjectKey("res1", "notes.pdf")).toBe(
      "private/resources/res1/notes.pdf",
    );
  });

  it("sanitizes filename bases", () => {
    expect(safeFilenameBase("My Notes (final).PDF")).toBe("My-Notes-final");
  });
});

describe("local driver", () => {
  it("writes, streams, and refuses traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eduvoq-storage-"));
    const driver = createLocalDriver(root);
    const objectKey = "private/resources/abc/notes.pdf";
    const body = pdfBytes();
    const put = await driver.put({
      objectKey,
      body,
      mimeType: "application/pdf",
    });
    expect(put.byteSize).toBe(body.byteLength);
    const onDisk = await readFile(path.join(root, "private/resources/abc/notes.pdf"));
    expect(onDisk.equals(body)).toBe(true);

    const stream = await driver.getStream(objectKey);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    expect(Buffer.concat(chunks).equals(body)).toBe(true);
    expect(await driver.presignGet(objectKey)).toBeNull();

    await expect(driver.getStream("private/resources/abc/missing.pdf")).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
    await expect(driver.getStream("private/../outside.pdf")).rejects.toThrow(/Invalid/);
  });
});
