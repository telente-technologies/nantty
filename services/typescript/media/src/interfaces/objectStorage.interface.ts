export interface StoredPart {
  readonly partNumber: number;
  readonly etag: string;
  readonly sizeBytes: number;
}

export interface PutObjectOptions {
  readonly contentType: string;
  readonly cacheControl?: string;
  readonly encrypted?: boolean;
}

export type ObjectBody = { readonly buffer: Uint8Array } | { readonly path: string };

export interface PresignedUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface ObjectStorage {
  createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string>;
  presignUploadPart(bucket: string, key: string, uploadId: string, partNumber: number, expiresInSeconds: number): Promise<string>;
  uploadPart(bucket: string, key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<string>;
  listParts(bucket: string, key: string, uploadId: string): Promise<readonly StoredPart[]>;
  completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: readonly StoredPart[]): Promise<void>;
  abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;
  presignPut(bucket: string, key: string, contentType: string, expiresInSeconds: number, sizeBytes: number): Promise<PresignedUpload>;
  headObject(bucket: string, key: string): Promise<{ readonly sizeBytes: number } | undefined>;
  readRange(bucket: string, key: string, start: number, endInclusive: number): Promise<Uint8Array>;
  downloadToFile(bucket: string, key: string, destinationPath: string): Promise<void>;
  putObject(bucket: string, key: string, body: ObjectBody, options: PutObjectOptions): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  deletePrefix(bucket: string, prefix: string): Promise<number>;
  signGetUrl(bucket: string, key: string, expiresInSeconds: number, downloadFileName?: string): Promise<string>;
}
