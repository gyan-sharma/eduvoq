export type FileDriverName = "local" | "s3";

export type PutObjectInput = {
  objectKey: string;
  body: Buffer;
  mimeType: string;
};

export type PutObjectResult = {
  bucket: string;
  objectKey: string;
  byteSize: number;
};

export interface FileDriver {
  readonly name: FileDriverName;
  readonly bucket: string;
  put(input: PutObjectInput): Promise<PutObjectResult>;
  getStream(objectKey: string): Promise<ReadableStream<Uint8Array>>;
  /** Browser-reachable GET URL, or null when the driver only streams through the app. */
  presignGet(objectKey: string, expiresSeconds?: number): Promise<string | null>;
  delete(objectKey: string): Promise<void>;
}
