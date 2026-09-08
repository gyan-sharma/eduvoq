import { createLocalDriver } from "@/lib/storage/local";
import { createS3Driver } from "@/lib/storage/s3";
import type { FileDriver } from "@/lib/storage/types";

let singleton: FileDriver | undefined;

export function createStorage(
  driver = (process.env.FILE_DRIVER ?? "local").toLowerCase(),
): FileDriver {
  if (driver === "s3") return createS3Driver();
  if (driver === "local" || driver === "") return createLocalDriver();
  throw new Error(`Unsupported FILE_DRIVER "${driver}". Use local or s3.`);
}

export function getStorage(): FileDriver {
  if (!singleton) {
    singleton = createStorage();
  }
  return singleton;
}

export type { FileDriver } from "@/lib/storage/types";
export { createLocalDriver } from "@/lib/storage/local";
export { createS3Driver } from "@/lib/storage/s3";
export { StorageNotFoundError, StorageConfigError } from "@/lib/storage/errors";
