import { createReadStream } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { StorageNotFoundError } from "@/lib/storage/errors";
import { assertSafeObjectKey } from "@/lib/storage/object-key";
import type { FileDriver, PutObjectInput, PutObjectResult } from "@/lib/storage/types";

function defaultRoot(): string {
  const fromEnv = process.env.FILE_LOCAL_ROOT;
  if (fromEnv) {
    return path.resolve(/* turbopackIgnore: true */ fromEnv);
  }
  return path.join(process.cwd(), "storage");
}

function resolveObjectPath(root: string, objectKey: string): string {
  const key = assertSafeObjectKey(objectKey);
  const full = path.resolve(/* turbopackIgnore: true */ root, ...key.split("/"));
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid object key");
  }
  return full;
}

export function createLocalDriver(root = defaultRoot()): FileDriver {
  const resolvedRoot = path.resolve(root);
  const bucket = "local";

  return {
    name: "local",
    bucket,
    async put(input: PutObjectInput): Promise<PutObjectResult> {
      const full = resolveObjectPath(resolvedRoot, input.objectKey);
      await mkdir(path.dirname(full), { recursive: true });
      const tmp = `${full}.tmp.${randomBytes(4).toString("hex")}`;
      await writeFile(tmp, input.body);
      await rename(tmp, full);
      return {
        bucket,
        objectKey: input.objectKey,
        byteSize: input.body.byteLength,
      };
    },
    async getStream(objectKey: string): Promise<ReadableStream<Uint8Array>> {
      const full = resolveObjectPath(resolvedRoot, objectKey);
      try {
        const nodeStream = createReadStream(full);
        await new Promise<void>((resolve, reject) => {
          nodeStream.once("open", () => resolve());
          nodeStream.once("error", reject);
        });
        return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code === "ENOENT") {
          throw new StorageNotFoundError(objectKey);
        }
        throw error;
      }
    },
    async presignGet(): Promise<string | null> {
      return null;
    },
    async delete(objectKey: string): Promise<void> {
      const full = resolveObjectPath(resolvedRoot, objectKey);
      try {
        await unlink(full);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "ENOENT") throw error;
      }
    },
  };
}
