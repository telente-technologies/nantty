import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { MediaConfig } from "../configs/media.config.js";
import type { ObjectBody, ObjectStorage, PresignedUpload, PutObjectOptions, StoredPart } from "../interfaces/objectStorage.interface.js";

function createClient(config: MediaConfig["storage"], endpoint: string | undefined): S3Client {
  return new S3Client({
    region: config.region,
    ...(endpoint === undefined ? {} : { endpoint }),
    forcePathStyle: config.forcePathStyle,
    ...(config.accessKeyId === undefined || config.secretAccessKey === undefined ? {} : { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }),
  });
}

const isMissing = (error: unknown) => {
  const name = (error as { name?: string }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
};

export function createS3ObjectStorage(config: MediaConfig["storage"]): ObjectStorage & { ensureBuckets(): Promise<void> } {
  const client = createClient(config, config.endpoint);
  const signingClient = config.publicEndpoint === undefined ? client : createClient(config, config.publicEndpoint);
  const encryption = (bucket: string, options?: PutObjectOptions) =>
    bucket === config.privateBucket && config.privateKmsKeyId !== undefined && options?.encrypted !== false ? { ServerSideEncryption: "aws:kms" as const, SSEKMSKeyId: config.privateKmsKeyId } : {};

  return {
    async ensureBuckets() {
      for (const bucket of new Set([config.quarantineBucket, config.publicBucket, config.privateBucket])) {
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        }
      }
    },
    async createMultipartUpload(bucket, key, contentType) {
      const result = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType, ...encryption(bucket) }));
      if (result.UploadId === undefined) throw new Error("object storage returned no multipart upload id");
      return result.UploadId;
    },
    presignUploadPart: (bucket, key, uploadId, partNumber, expiresInSeconds) =>
      getSignedUrl(signingClient, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: expiresInSeconds }),
    async uploadPart(bucket, key, uploadId, partNumber, body) {
      const result = await client.send(new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body, ContentLength: body.byteLength }));
      return result.ETag ?? "";
    },
    async listParts(bucket, key, uploadId) {
      const parts: StoredPart[] = [];
      let marker: string | undefined;
      for (;;) {
        const page = await client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, ...(marker === undefined ? {} : { PartNumberMarker: marker }) }));
        for (const part of page.Parts ?? []) {
          if (part.PartNumber !== undefined && part.ETag !== undefined) parts.push({ partNumber: part.PartNumber, etag: part.ETag, sizeBytes: part.Size ?? 0 });
        }
        if (page.IsTruncated !== true || page.NextPartNumberMarker === undefined) return parts;
        marker = page.NextPartNumberMarker;
      }
    },
    async completeMultipartUpload(bucket, key, uploadId, parts) {
      await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) } }));
    },
    async abortMultipartUpload(bucket, key, uploadId) {
      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
    },
    async presignPut(bucket, key, contentType, expiresInSeconds, sizeBytes): Promise<PresignedUpload> {
      const url = await getSignedUrl(signingClient, new PutObjectCommand({ Bucket: bucket, Key: key, ContentLength: sizeBytes, ...encryption(bucket) }), { expiresIn: expiresInSeconds, signableHeaders: new Set(["content-length"]) });
      void contentType;
      return { url, headers: {} };
    },
    async headObject(bucket, key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { sizeBytes: head.ContentLength ?? 0 };
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },
    async readRange(bucket, key, start, endInclusive) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${endInclusive}` }));
      return (await result.Body?.transformToByteArray()) ?? new Uint8Array();
    },
    async downloadToFile(bucket, key, destinationPath) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      await pipeline(result.Body as Readable, createWriteStream(destinationPath));
    },
    async putObject(bucket, key, body: ObjectBody, options: PutObjectOptions) {
      const common = { Bucket: bucket, Key: key, ContentType: options.contentType, ...(options.cacheControl === undefined ? {} : { CacheControl: options.cacheControl }), ...encryption(bucket, options) };
      if ("buffer" in body) await client.send(new PutObjectCommand({ ...common, Body: body.buffer }));
      else await client.send(new PutObjectCommand({ ...common, Body: createReadStream(body.path), ContentLength: (await stat(body.path)).size }));
    },
    async deleteObject(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async deletePrefix(bucket, prefix) {
      let deleted = 0;
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ...(token === undefined ? {} : { ContinuationToken: token }) }));
        const keys = (page.Contents ?? []).flatMap((item) => (item.Key === undefined ? [] : [{ Key: item.Key }]));
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
          deleted += keys.length;
        }
        token = page.IsTruncated === true ? page.NextContinuationToken : undefined;
      } while (token !== undefined);
      return deleted;
    },
    signGetUrl: (bucket, key, expiresInSeconds, downloadFileName) =>
      getSignedUrl(signingClient, new GetObjectCommand({ Bucket: bucket, Key: key, ...(downloadFileName === undefined ? {} : { ResponseContentDisposition: `attachment; filename="${downloadFileName.replaceAll(/["\\\r\n]/g, "_")}"` }) }), { expiresIn: expiresInSeconds }),
  };
}
