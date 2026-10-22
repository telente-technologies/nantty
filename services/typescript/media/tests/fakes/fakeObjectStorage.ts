import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ObjectBody, ObjectStorage, PutObjectOptions, StoredPart } from "../../src/interfaces/objectStorage.interface.js";

export class FakeObjectStorage implements ObjectStorage {
  public readonly objects = new Map<string, { body: Buffer; options: PutObjectOptions | undefined }>();
  public readonly multipart = new Map<string, Map<number, Buffer>>();

  public key(bucket: string, key: string) {
    return `${bucket}/${key}`;
  }

  public seed(bucket: string, key: string, body: Uint8Array) {
    this.objects.set(this.key(bucket, key), { body: Buffer.from(body), options: undefined });
  }

  public keysIn(bucket: string): string[] {
    return [...this.objects.keys()].filter((entry) => entry.startsWith(`${bucket}/`)).map((entry) => entry.slice(bucket.length + 1));
  }

  async createMultipartUpload(bucket: string, key: string) {
    const uploadId = `upload-${this.multipart.size + 1}`;
    this.multipart.set(`${bucket}/${key}/${uploadId}`, new Map());
    return uploadId;
  }
  async presignUploadPart(bucket: string, key: string, _uploadId: string, partNumber: number, expiresInSeconds: number) {
    return `https://s3.test/${bucket}/${key}?partNumber=${partNumber}&expires=${expiresInSeconds}`;
  }
  async uploadPart(bucket: string, key: string, uploadId: string, partNumber: number, body: Uint8Array) {
    this.multipart.get(`${bucket}/${key}/${uploadId}`)?.set(partNumber, Buffer.from(body));
    return `"etag-${partNumber}"`;
  }
  async listParts(bucket: string, key: string, uploadId: string): Promise<StoredPart[]> {
    return [...(this.multipart.get(`${bucket}/${key}/${uploadId}`)?.entries() ?? [])].map(([partNumber, body]) => ({ partNumber, etag: `"etag-${partNumber}"`, sizeBytes: body.byteLength }));
  }
  async completeMultipartUpload(bucket: string, key: string, uploadId: string) {
    const parts = [...(this.multipart.get(`${bucket}/${key}/${uploadId}`)?.entries() ?? [])].sort((left, right) => left[0] - right[0]);
    this.seed(bucket, key, Buffer.concat(parts.map(([, body]) => body)));
  }
  async abortMultipartUpload(bucket: string, key: string, uploadId: string) {
    this.multipart.delete(`${bucket}/${key}/${uploadId}`);
  }
  async presignPut(bucket: string, key: string, contentType: string, expiresInSeconds: number, sizeBytes: number) {
    return { url: `https://s3.test/${bucket}/${key}?size=${sizeBytes}&expires=${expiresInSeconds}`, headers: { "content-type": contentType } };
  }
  async headObject(bucket: string, key: string) {
    const found = this.objects.get(this.key(bucket, key));
    return found === undefined ? undefined : { sizeBytes: found.body.byteLength };
  }
  async readRange(bucket: string, key: string, start: number, endInclusive: number) {
    return this.objects.get(this.key(bucket, key))?.body.subarray(start, endInclusive + 1) ?? new Uint8Array();
  }
  async downloadToFile(bucket: string, key: string, destinationPath: string) {
    const found = this.objects.get(this.key(bucket, key));
    if (found === undefined) throw new Error(`missing object ${bucket}/${key}`);
    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, found.body);
  }
  async putObject(bucket: string, key: string, body: ObjectBody, options: PutObjectOptions) {
    this.objects.set(this.key(bucket, key), { body: "buffer" in body ? Buffer.from(body.buffer) : await readFile(body.path), options });
  }
  async deleteObject(bucket: string, key: string) {
    this.objects.delete(this.key(bucket, key));
  }
  async deletePrefix(bucket: string, prefix: string) {
    const matching = [...this.objects.keys()].filter((entry) => entry.startsWith(`${bucket}/${prefix}`));
    for (const entry of matching) this.objects.delete(entry);
    return matching.length;
  }
  async signGetUrl(bucket: string, key: string, expiresInSeconds: number) {
    return `https://signed.test/${bucket}/${key}?expires=${expiresInSeconds}`;
  }
}
