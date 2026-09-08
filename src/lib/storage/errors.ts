export class StorageNotFoundError extends Error {
  constructor(objectKey: string) {
    super(`Object not found: ${objectKey}`);
    this.name = "StorageNotFoundError";
  }
}

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}
