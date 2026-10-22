import { createHash, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createAbortUploadSessionHandler } from "../../src/modules/uploads/commands/abortUploadSession/abortUploadSession.handler.js";
import { createCompleteUploadSessionHandler } from "../../src/modules/uploads/commands/completeUploadSession/completeUploadSession.handler.js";
import { createCreateUploadSessionHandler } from "../../src/modules/uploads/commands/createUploadSession/createUploadSession.handler.js";
import { createUploadChunkHandler } from "../../src/modules/uploads/commands/uploadChunk/uploadChunk.handler.js";
import { createGetChunkUploadUrlHandler } from "../../src/modules/uploads/queries/getChunkUploadUrl/getChunkUploadUrl.handler.js";
import { createGetChunkUploadUrlsHandler } from "../../src/modules/uploads/queries/getChunkUploadUrls/getChunkUploadUrls.handler.js";
import { createGetUploadSessionHandler } from "../../src/modules/uploads/queries/getUploadSession/getUploadSession.handler.js";
import { createHarness } from "../fakes/pipelineHarness.js";

const mebibyte = 1024 * 1024;

async function startUpload(sizeBytes = 20 * mebibyte, overrides: { purpose?: "post" | "kyc"; mimeType?: string; idempotencyKey?: string } = {}) {
  const harness = createHarness({ config: { allowProxiedChunks: true } });
  const ownerId = randomUUID();
  const create = createCreateUploadSessionHandler(harness.context);
  const session = await create({ ownerId, fileName: "a.mp4", mimeType: overrides.mimeType ?? "video/mp4", sizeBytes, purpose: overrides.purpose ?? "post", sha256: undefined, idempotencyKey: overrides.idempotencyKey });
  return { harness, ownerId, session, create };
}

describe("resumable chunked uploads", () => {
  it("creates a multipart session with the plan and an asset in the uploading state", async () => {
    const { harness, session } = await startUpload();
    expect(session).toMatchObject({ mode: "multipart", partSizeBytes: 8 * mebibyte, partCount: 3, chunkSizeBytes: 8 * mebibyte, totalChunks: 3, uploadedChunks: [], uploadMode: "proxied", recommendedParallelism: 4 });
    expect(harness.db.assets.get(session.mediaId)).toMatchObject({ status: "uploading", kind: "video", isPrivate: false });
  });

  it("rejects disallowed types and oversized files before touching storage", async () => {
    const harness = createHarness();
    const create = createCreateUploadSessionHandler(harness.context);
    const base = { ownerId: randomUUID(), fileName: "a", sha256: undefined, idempotencyKey: undefined };
    await expect(create({ ...base, mimeType: "video/mp4", sizeBytes: 1000, purpose: "avatar" })).rejects.toMatchObject({ status: 415 });
    await expect(create({ ...base, mimeType: "application/pdf", sizeBytes: 11 * mebibyte, purpose: "kyc" })).rejects.toMatchObject({ status: 413 });
    expect(harness.storage.multipart.size).toBe(0);
  });

  it("returns the same session for a repeated idempotency key", async () => {
    const { session, create, ownerId, harness } = await startUpload(20 * mebibyte, { idempotencyKey: "retry-key-0001" });
    const again = await create({ ownerId, fileName: "a.mp4", mimeType: "video/mp4", sizeBytes: 20 * mebibyte, purpose: "post", sha256: undefined, idempotencyKey: "retry-key-0001" });
    expect(again.uploadId).toBe(session.uploadId);
    expect(harness.storage.multipart.size).toBe(1);
  });

  it("accepts chunks in any order, reports progress for resume, and rejects bad chunks", async () => {
    const { harness, ownerId, session } = await startUpload();
    const upload = createUploadChunkHandler(harness.context);
    const chunk = (index: number, size: number) => ({ ownerId, uploadId: session.uploadId, chunkIndex: index, bytes: new Uint8Array(size).fill(index + 1), sha256: undefined });
    expect((await upload(chunk(2, 4 * mebibyte))).uploadedChunks).toEqual([2]);
    expect((await upload(chunk(0, 8 * mebibyte))).uploadedChunks).toEqual([0, 2]);
    await expect(upload(chunk(1, 3 * mebibyte))).rejects.toMatchObject({ code: "CHUNK_SIZE_MISMATCH" });
    await expect(upload(chunk(9, 8 * mebibyte))).rejects.toMatchObject({ code: "CHUNK_OUT_OF_RANGE" });
    await expect(upload({ ...chunk(1, 8 * mebibyte), sha256: "0".repeat(64) })).rejects.toMatchObject({ code: "CHUNK_CHECKSUM_MISMATCH" });
    const good = chunk(1, 8 * mebibyte);
    await expect(upload({ ...good, sha256: createHash("sha256").update(good.bytes).digest("hex") })).resolves.toEqual({ uploadedChunks: [0, 1, 2] });
    const status = await createGetUploadSessionHandler(harness.context)({ ownerId, uploadId: session.uploadId });
    expect(status).toEqual({ status: "uploading", uploadedChunks: [0, 1, 2] });
  });

  it("hides sessions from other accounts", async () => {
    const { harness, session } = await startUpload();
    await expect(createGetUploadSessionHandler(harness.context)({ ownerId: randomUUID(), uploadId: session.uploadId })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to complete with missing chunks, then completes, queues processing and emits media.uploaded", async () => {
    const { harness, ownerId, session } = await startUpload();
    const upload = createUploadChunkHandler(harness.context);
    const complete = createCompleteUploadSessionHandler(harness.context);
    await upload({ ownerId, uploadId: session.uploadId, chunkIndex: 0, bytes: new Uint8Array(8 * mebibyte), sha256: undefined });
    await expect(complete({ ownerId, lookup: { uploadId: session.uploadId } })).rejects.toMatchObject({ code: "CHUNKS_MISSING" });
    await upload({ ownerId, uploadId: session.uploadId, chunkIndex: 1, bytes: new Uint8Array(8 * mebibyte), sha256: undefined });
    await upload({ ownerId, uploadId: session.uploadId, chunkIndex: 2, bytes: new Uint8Array(4 * mebibyte), sha256: undefined });
    expect(await complete({ ownerId, lookup: { uploadId: session.uploadId } })).toEqual({ mediaId: session.mediaId, status: "processing" });
    expect(harness.db.assets.get(session.mediaId)?.["status"]).toBe("uploaded");
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.enqueued[0]?.job).toMatchObject({ type: "media.process", payload: { mediaId: session.mediaId } });
    expect(harness.db.eventTypes()).toEqual(["media.uploaded"]);
    expect(harness.storage.objects.size).toBe(1);
    await complete({ ownerId, lookup: { mediaId: session.mediaId } });
    expect(harness.enqueued).toHaveLength(1);
  });

  it("aborts a session and discards the multipart upload", async () => {
    const { harness, ownerId, session } = await startUpload();
    await createAbortUploadSessionHandler(harness.context)({ ownerId, uploadId: session.uploadId });
    expect(harness.storage.multipart.size).toBe(0);
    expect(harness.db.assets.get(session.mediaId)?.["status"]).toBe("deleted");
  });

  it("keeps identity documents in the private asset class from the start", async () => {
    const { harness, session } = await startUpload(2 * mebibyte, { purpose: "kyc", mimeType: "application/pdf" });
    expect(harness.db.assets.get(session.mediaId)).toMatchObject({ isPrivate: true, kind: "document" });
  });

  it("keeps large chunks off the api unless the dev-only proxied route is enabled", async () => {
    const { harness, ownerId, session } = await startUpload();
    const strict = { ...harness.context, config: { ...harness.context.config, allowProxiedChunks: false } };
    await expect(createUploadChunkHandler(strict)({ ownerId, uploadId: session.uploadId, chunkIndex: 0, bytes: new Uint8Array(8 * mebibyte), sha256: undefined })).rejects.toMatchObject({ status: 403, code: "PROXIED_CHUNKS_DISABLED" });
    expect((await createCreateUploadSessionHandler(strict)({ ownerId, fileName: "b.mp4", mimeType: "video/mp4", sizeBytes: 30 * mebibyte, purpose: "post", sha256: undefined, idempotencyKey: undefined })).uploadMode).toBe("presigned");
  });

  it("answers files under 8 MB with a single presigned PUT and completes them with a HEAD check", async () => {
    const { harness, ownerId, session } = await startUpload(3 * mebibyte, { purpose: "post", mimeType: "image/jpeg" });
    expect(session).toMatchObject({ mode: "single", partCount: 1, partSizeBytes: 3 * mebibyte, uploadedChunks: [] });
    expect(session.url).toContain("size=3145728");
    expect(session.headers).toEqual({ "content-type": "image/jpeg" });
    expect(harness.storage.multipart.size).toBe(0);
    await expect(createUploadChunkHandler(harness.context)({ ownerId, uploadId: session.uploadId, chunkIndex: 0, bytes: new Uint8Array(1), sha256: undefined })).rejects.toMatchObject({ code: "CHUNKS_NOT_SUPPORTED" });
    const single = await createGetChunkUploadUrlHandler(harness.context)({ ownerId, uploadId: session.uploadId, chunkIndex: 0 });
    expect(single).toMatchObject({ method: "PUT", expectedBytes: 3 * mebibyte });
    expect(single.url).toContain("size=3145728");
    await expect(createGetChunkUploadUrlHandler(harness.context)({ ownerId, uploadId: session.uploadId, chunkIndex: 1 })).rejects.toMatchObject({ code: "CHUNK_OUT_OF_RANGE" });
    const complete = createCompleteUploadSessionHandler(harness.context);
    await expect(complete({ ownerId, lookup: { mediaId: session.mediaId } })).rejects.toMatchObject({ code: "UPLOAD_NOT_RECEIVED" });
    const created = harness.db.assets.get(session.mediaId)!;
    harness.storage.seed(created["quarantineBucket"] as string, created["quarantineKey"] as string, new Uint8Array(3 * mebibyte));
    expect(await complete({ ownerId, lookup: { mediaId: session.mediaId } })).toEqual({ mediaId: session.mediaId, status: "processing" });
    expect(harness.enqueued).toHaveLength(1);
  });

  it("presigns a batch of part urls with the expected sizes and validates the batch", async () => {
    const { harness, ownerId, session } = await startUpload(20 * mebibyte);
    const batch = createGetChunkUploadUrlsHandler(harness.context);
    const result = await batch({ ownerId, uploadId: session.uploadId, chunkIndexes: [0, 1, 2, 2] });
    expect(result.urls.map((entry) => [entry.chunkIndex + 1, entry.expectedBytes])).toEqual([[1, 8 * mebibyte], [2, 8 * mebibyte], [3, 4 * mebibyte]]);
    expect(result.urls[2]?.url).toContain("partNumber=3");
    await expect(batch({ ownerId, uploadId: session.uploadId, chunkIndexes: [3] })).rejects.toMatchObject({ code: "CHUNK_OUT_OF_RANGE" });
    await expect(batch({ ownerId, uploadId: session.uploadId, chunkIndexes: [] })).rejects.toMatchObject({ code: "INVALID_PART_BATCH" });
    await expect(batch({ ownerId, uploadId: session.uploadId, chunkIndexes: Array.from({ length: 17 }, (_, index) => index) })).rejects.toMatchObject({ code: "INVALID_PART_BATCH" });
    await expect(batch({ ownerId: randomUUID(), uploadId: session.uploadId, chunkIndexes: [0] })).rejects.toMatchObject({ status: 404 });
  });
});
