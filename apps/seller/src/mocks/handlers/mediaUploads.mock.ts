import { createHash } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export const allowedProductImageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const maximumImageBytes = 10 * 1024 * 1024;
const chunkSizeBytes = 1024 * 1024;
const maximumInlineDataUrlBytes = 2 * 1024 * 1024;
const fallbackLargeImageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&fm=webp";

function hashBytesAsHex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function doBytesMatchDeclaredImageType(bytes: Uint8Array, mimeType: string): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  if (mimeType === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (mimeType === "image/avif") return ascii(4, 8) === "ftyp" && ascii(8, 12).startsWith("avi");
  return false;
}

const encryptedChatMimeType = "application/vnd.nantty.encrypted";
const maximumChatBytes = 100 * 1024 * 1024;
export const mockChatMediaBlobs = new Map<string, Uint8Array>();

function findUploadOrThrow(uploadId: string) {
  const upload = readMockDatabase().uploads.get(uploadId);
  if (!upload) throw new MockHttpError(404, "UPLOAD_NOT_FOUND", "That upload has expired. Start it again.");
  return upload;
}

export function registerMediaUploadMockRoutes(): void {
  registerMockRoute("POST", "/media/uploads", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const mimeType = String(body.mimeType ?? "");
    const sizeBytes = body.sizeBytes;
    if (fileName.length < 1 || fileName.length > 200) throw new MockHttpError(400, "INVALID_FILE_NAME", "The file needs a name of 200 characters or fewer.");
    const isChat = body.purpose === "chat";
    if (isChat && mimeType !== encryptedChatMimeType) throw new MockHttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Chat attachments must be encrypted before upload.");
    if (!isChat && !(allowedProductImageMimeTypes as readonly string[]).includes(mimeType)) throw new MockHttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPEG, PNG, WebP or AVIF image.");
    if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > (isChat ? maximumChatBytes : maximumImageBytes)) throw new MockHttpError(413, "FILE_TOO_LARGE", isChat ? "Files can be up to 100 MB." : "Images must be 10 MB or smaller.");
    if (!isChat && body.purpose !== "product") throw new MockHttpError(400, "INVALID_PURPOSE", "Uploads here are for product images.");
    if (body.sha256 !== undefined && (typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.sha256))) throw new MockHttpError(400, "INVALID_SHA256", "The file checksum is not valid.");
    const uploadId = createMockIdentifier("upl");
    const totalChunks = Math.ceil(sizeBytes / chunkSizeBytes);
    readMockDatabase().uploads.set(uploadId, { uploadId, fileName, mimeType, sizeBytes, chunkSizeBytes, totalChunks, receivedChunks: new Map(), mediaId: typeof body.sha256 === "string" ? `sha256:${body.sha256}` : null });
    return respondWithJson(201, { mode: "multipart", uploadMode: "proxied", uploadId, mediaId: createMockIdentifier("media"), chunkSizeBytes, totalChunks, uploadedChunks: [] });
  });

  registerMockRoute("PUT", "/media/uploads/:uploadId/chunks/:chunkIndex", (request) => {
    requireMockStorePrincipal(request);
    const upload = findUploadOrThrow(request.params.uploadId ?? "");
    const chunkIndex = Number(request.params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.totalChunks) throw new MockHttpError(400, "INVALID_CHUNK_INDEX", "That chunk number is out of range.");
    const chunkBytes = request.binaryBody ?? new Uint8Array();
    const isLastChunk = chunkIndex === upload.totalChunks - 1;
    const expectedBytes = isLastChunk ? upload.sizeBytes - chunkIndex * upload.chunkSizeBytes : upload.chunkSizeBytes;
    if (chunkBytes.byteLength !== expectedBytes) throw new MockHttpError(400, "CHUNK_SIZE_MISMATCH", `Chunk ${chunkIndex} should be ${expectedBytes} bytes.`);
    const declaredHash = request.headers.get("x-chunk-sha256")?.toLowerCase() ?? "";
    if (declaredHash !== hashBytesAsHex(chunkBytes)) throw new MockHttpError(422, "CHUNK_CHECKSUM_MISMATCH", `Chunk ${chunkIndex} was damaged on the way. It will be sent again.`);
    upload.receivedChunks.set(chunkIndex, chunkBytes);
    return respondWithJson(200, { uploadId: upload.uploadId, uploadedChunks: [...upload.receivedChunks.keys()].sort((first, second) => first - second) });
  });

  registerMockRoute("POST", "/media/uploads/:uploadId/complete", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const upload = findUploadOrThrow(request.params.uploadId ?? "");
    const missingChunks = Array.from({ length: upload.totalChunks }, (_, index) => index).filter((index) => !upload.receivedChunks.has(index));
    if (missingChunks.length > 0) throw new MockHttpError(409, "UPLOAD_INCOMPLETE", `Chunks ${missingChunks.join(", ")} are still missing.`);
    const fileBytes = new Uint8Array(upload.sizeBytes);
    for (let index = 0; index < upload.totalChunks; index += 1) fileBytes.set(upload.receivedChunks.get(index) ?? new Uint8Array(), index * upload.chunkSizeBytes);
    if (upload.mediaId?.startsWith("sha256:") && upload.mediaId.slice(7) !== hashBytesAsHex(fileBytes)) throw new MockHttpError(422, "FILE_CHECKSUM_MISMATCH", "The file changed during upload. Try again.");
    if (upload.mimeType === encryptedChatMimeType) {
      const chatMediaId = createMockIdentifier("media");
      mockChatMediaBlobs.set(chatMediaId, fileBytes);
      database.media.set(chatMediaId, { mediaId: chatMediaId, url: `/bff/media/${chatMediaId}/encrypted-blob`, mimeType: upload.mimeType, status: "ready" });
      database.uploads.delete(upload.uploadId);
      return respondWithJson(200, { mediaId: chatMediaId, status: "ready" });
    }
    if (!doBytesMatchDeclaredImageType(fileBytes, upload.mimeType)) throw new MockHttpError(415, "FILE_TYPE_MISMATCH", "This file is not the image type it claims to be.");
    const mediaId = createMockIdentifier("media");
    const url = fileBytes.byteLength <= maximumInlineDataUrlBytes ? `data:${upload.mimeType};base64,${Buffer.from(fileBytes).toString("base64")}` : fallbackLargeImageUrl;
    database.media.set(mediaId, { mediaId, url, mimeType: upload.mimeType, status: "ready" });
    database.uploads.delete(upload.uploadId);
    return respondWithJson(200, { mediaId, status: "processing" });
  });

  registerMockRoute("DELETE", "/media/uploads/:uploadId", (request) => {
    requireMockStorePrincipal(request);
    readMockDatabase().uploads.delete(request.params.uploadId ?? "");
    return { status: 204, body: null };
  });

  registerMockRoute("GET", "/media/:mediaId/encrypted-blob", (request) => {
    requireMockStorePrincipal(request);
    const bytes = mockChatMediaBlobs.get(request.params.mediaId ?? "");
    if (!bytes) throw new MockHttpError(404, "MEDIA_NOT_FOUND", "This attachment has expired.");
    return { status: 200, body: bytes, contentType: "application/octet-stream" };
  });

  registerMockRoute("GET", "/media/:mediaId", (request) => {
    requireMockStorePrincipal(request);
    const media = readMockDatabase().media.get(request.params.mediaId ?? "");
    if (!media) throw new MockHttpError(404, "MEDIA_NOT_FOUND", "That image does not exist.");
    return respondWithJson(200, { id: media.mediaId, status: media.status, variants: media.url ? [{ url: media.url, width: 1080, height: 1080, format: media.mimeType.replace("image/", "") }] : [] });
  });
}
