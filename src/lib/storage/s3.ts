import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageConfigError, StorageNotFoundError } from "@/lib/storage/errors";
import { assertSafeObjectKey } from "@/lib/storage/object-key";
import type { FileDriver, PutObjectInput, PutObjectResult } from "@/lib/storage/types";

type S3DriverConfig = {
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
};

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function configFromEnv(): S3DriverConfig {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!bucket || !accessKey || !secretKey) {
    throw new StorageConfigError(
      "FILE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY.",
    );
  }
  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    bucket,
    accessKey,
    secretKey,
    forcePathStyle: envFlag(process.env.S3_FORCE_PATH_STYLE, true),
  };
}

function clientFor(config: S3DriverConfig, endpoint = config.endpoint): S3Client {
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });
}

function isMissingKey(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const httpStatus =
    "$metadata" in error &&
    error.$metadata &&
    typeof error.$metadata === "object" &&
    "httpStatusCode" in error.$metadata
      ? Number(error.$metadata.httpStatusCode)
      : 0;
  return name === "NoSuchKey" || name === "NotFound" || httpStatus === 404;
}

export function createS3Driver(config = configFromEnv()): FileDriver {
  const client = clientFor(config);
  const signClient = config.publicEndpoint
    ? clientFor(config, config.publicEndpoint)
    : client;
  let bucketReady: Promise<void> | undefined;

  async function ensureBucket(): Promise<void> {
    if (!bucketReady) {
      bucketReady = (async () => {
        try {
          await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
        } catch {
          await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
        }
      })();
    }
    await bucketReady;
  }

  return {
    name: "s3",
    bucket: config.bucket,
    async put(input: PutObjectInput): Promise<PutObjectResult> {
      const objectKey = assertSafeObjectKey(input.objectKey);
      await ensureBucket();
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: input.body,
          ContentType: input.mimeType,
          ContentLength: input.body.byteLength,
        }),
      );
      return {
        bucket: config.bucket,
        objectKey,
        byteSize: input.body.byteLength,
      };
    },
    async getStream(objectKey: string): Promise<ReadableStream<Uint8Array>> {
      const key = assertSafeObjectKey(objectKey);
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        if (!result.Body) {
          throw new StorageNotFoundError(key);
        }
        return result.Body.transformToWebStream();
      } catch (error) {
        if (error instanceof StorageNotFoundError) throw error;
        if (isMissingKey(error)) throw new StorageNotFoundError(key);
        throw error;
      }
    },
    async presignGet(objectKey: string, expiresSeconds = 60): Promise<string | null> {
      const key = assertSafeObjectKey(objectKey);
      const ttl = Math.min(Math.max(expiresSeconds, 1), 300);
      return getSignedUrl(
        signClient,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: ttl },
      );
    },
    async delete(objectKey: string): Promise<void> {
      const key = assertSafeObjectKey(objectKey);
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },
  };
}
