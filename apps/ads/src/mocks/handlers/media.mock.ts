import { createHash } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, readJsonObjectBody, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

const chunkSizeBytes = 4 * 1024 * 1024;
const maximumMockUploadBytes = 60 * 1024 * 1024;
const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"];

const globalHolder = globalThis as typeof globalThis & { zudomartAdsMockChunks?: Map<string, Map<number, Uint8Array>>; zudomartAdsMockFiles?: Map<string, { mimeType: string; bytes: Buffer }> };
const chunkStore = (globalHolder.zudomartAdsMockChunks ??= new Map());
const fileStore = (globalHolder.zudomartAdsMockFiles ??= new Map());

export function registerMediaMockHandlers(): void {
  registerMockRoute("POST", "/media/uploads", (request) => {
    const principal = requirePrincipal(request);
    const body = readJsonObjectBody(request);
    const mimeType = String(body.mimeType ?? "");
    const sizeBytes = Number(body.sizeBytes);
    if (!acceptedMimeTypes.includes(mimeType)) throw new MockHttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPG, PNG, WebP, AVIF, MP4 or MOV file.");
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maximumMockUploadBytes) throw new MockHttpError(413, "FILE_TOO_LARGE", "The demo backend accepts files up to 60 MB.");
    const uploadId = createMockId("upl");
    const totalChunks = Math.ceil(sizeBytes / chunkSizeBytes);
    readMockDatabase().uploads.set(uploadId, { uploadId, userId: principal.userId, fileName: String(body.fileName ?? "upload").slice(0, 200), mimeType, sizeBytes, chunkSizeBytes, totalChunks, uploadedChunks: new Set(), mediaId: null });
    chunkStore.set(uploadId, new Map());
    return respondWithJson(201, { uploadId, chunkSizeBytes, totalChunks, uploadedChunks: [] });
  });

  registerMockRoute("PUT", "/media/uploads/:uploadId/chunks/:chunkIndex", (request) => {
    const principal = requirePrincipal(request);
    const upload = readMockDatabase().uploads.get(request.params.uploadId ?? "");
    if (!upload || upload.userId !== principal.userId) throw new MockHttpError(404, "NOT_FOUND", "Upload not found.");
    const chunkIndex = Number(request.params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.totalChunks) throw new MockHttpError(400, "BAD_CHUNK_INDEX", "That chunk number is out of range.");
    const bytes = request.binaryBody ?? new Uint8Array();
    const expectedLength = Math.min(upload.chunkSizeBytes, upload.sizeBytes - chunkIndex * upload.chunkSizeBytes);
    if (bytes.byteLength !== expectedLength) throw new MockHttpError(400, "BAD_CHUNK_LENGTH", "The chunk size does not match.");
    const declaredHash = request.headers.get("x-chunk-sha256") ?? "";
    if (createHash("sha256").update(bytes).digest("hex") !== declaredHash) throw new MockHttpError(422, "CHUNK_CHECKSUM_MISMATCH", "The chunk was corrupted in transit. It will be retried.");
    chunkStore.get(upload.uploadId)?.set(chunkIndex, bytes);
    upload.uploadedChunks.add(chunkIndex);
    return respondWithJson(200, { uploadedChunks: [...upload.uploadedChunks].sort((first, second) => first - second) });
  });

  registerMockRoute("POST", "/media/uploads/:uploadId/complete", (request) => {
    const principal = requirePrincipal(request);
    const database = readMockDatabase();
    const upload = database.uploads.get(request.params.uploadId ?? "");
    if (!upload || upload.userId !== principal.userId) throw new MockHttpError(404, "NOT_FOUND", "Upload not found.");
    if (upload.uploadedChunks.size !== upload.totalChunks) throw new MockHttpError(409, "UPLOAD_INCOMPLETE", "Some chunks are missing.");
    const chunks = chunkStore.get(upload.uploadId) ?? new Map<number, Uint8Array>();
    const bytes = Buffer.concat(Array.from({ length: upload.totalChunks }, (_, index) => chunks.get(index) ?? new Uint8Array()));
    chunkStore.delete(upload.uploadId);
    const mediaId = upload.mediaId ?? createMockId("med");
    upload.mediaId = mediaId;
    fileStore.set(mediaId, { mimeType: upload.mimeType, bytes });
    const isVideo = upload.mimeType.startsWith("video/");
    database.media.set(mediaId, { createdAtEpochMs: Date.now(), media: { id: mediaId, kind: isVideo ? "video" : "image", url: `/bff/media/${mediaId}`, posterUrl: null, width: isVideo ? 1080 : 1080, height: isVideo ? 1920 : 1080, durationSeconds: isVideo ? 15 : null } });
    return respondWithJson(200, { mediaId, status: "processing" });
  });

  registerMockRoute("GET", "/media/:mediaId", (request) => {
    requirePrincipal(request);
    const file = fileStore.get(request.params.mediaId ?? "");
    if (!file) throw new MockHttpError(404, "NOT_FOUND", "Media not found.");
    return { status: 200, body: new Uint8Array(file.bytes), contentType: file.mimeType, headers: { "Cache-Control": "private, max-age=3600" } };
  });
}
