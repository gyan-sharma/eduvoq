const OBJECT_KEY_MAX = 200;

/** Opaque storage keys: public|private / … with no traversal. */
export function assertSafeObjectKey(objectKey: string): string {
  const normalized = objectKey.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.length > OBJECT_KEY_MAX ||
    normalized.startsWith("/") ||
    normalized.includes("\0")
  ) {
    throw new Error("Invalid object key");
  }
  const parts = normalized.split("/");
  if (parts.length < 2 || parts.length > 8) {
    throw new Error("Invalid object key");
  }
  if (parts[0] !== "public" && parts[0] !== "private") {
    throw new Error("Invalid object key");
  }
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Invalid object key");
  }
  if (!/^[a-zA-Z0-9/_.-]+$/.test(normalized)) {
    throw new Error("Invalid object key");
  }
  return normalized;
}

export function safeFilenameBase(originalName: string): string {
  const base = originalName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "file";
}

export function productObjectKey(productId: string, filename: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(productId)) {
    throw new Error("Invalid product id");
  }
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    !/^[a-zA-Z0-9._-]+$/.test(filename)
  ) {
    throw new Error("Invalid filename");
  }
  return assertSafeObjectKey(`public/products/${productId}/${filename}`);
}

export function resourceObjectKey(resourceId: string, filename: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(resourceId)) {
    throw new Error("Invalid resource id");
  }
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    !/^[a-zA-Z0-9._-]+$/.test(filename)
  ) {
    throw new Error("Invalid filename");
  }
  return assertSafeObjectKey(`private/resources/${resourceId}/${filename}`);
}

export function objectKeyFilename(objectKey: string): string {
  const name = objectKey.replace(/\\/g, "/").split("/").pop();
  return name && name.length > 0 ? name : "download";
}
