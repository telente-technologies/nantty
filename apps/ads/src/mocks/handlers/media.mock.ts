import { requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, readJsonObjectBody, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

const maximumMockUploadBytes = 12 * 1024 * 1024;
const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"];
const uploadUrlLifetimeMilliseconds = 30 * 60 * 1000;

const globalHolder = globalThis as typeof globalThis & { zudomartAdsMockFiles?: Map<string, { mimeType: string; bytes: Buffer }> };
const fileStore = (globalHolder.zudomartAdsMockFiles ??= new Map());

function readClientMetadata(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") failValidation("clientMetadata", "clientMetadata must be an object.");
  const record = value as Record<string, unknown>;
  for (const field of ["width", "height", "durationSeconds"]) {
    const fieldValue = record[field];
    if (fieldValue !== null && fieldValue !== undefined && !Number.isInteger(fieldValue)) throw new MockHttpError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  if (!Number.isInteger(record.width) || !Number.isInteger(record.height)) return null;
  return { width: record.width as number, height: record.height as number, durationSeconds: Number.isInteger(record.durationSeconds) ? (record.durationSeconds as number) : null };
}

export function registerMediaMockHandlers(): void {
  registerMockRoute("POST", "/ads/accounts/:accountId/creatives/media/uploads", (request) => {
    const { account, userId } = requireAccountAccess(request, "campaigns:manage");
    const body = readJsonObjectBody(request);
    const mimeType = String(body.mimeType ?? "");
    const sizeBytes = Number(body.sizeBytes);
    const fileName = String(body.fileName ?? "").trim().slice(0, 200);
    if (!fileName) failValidation("fileName", "Send the file name.");
    if (!acceptedMimeTypes.includes(mimeType)) throw new MockHttpError(415, "MEDIA_TYPE_NOT_SUPPORTED", "Upload a JPG, PNG, WebP, AVIF, MP4 or MOV file.");
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1) failValidation("sizeBytes", "The file is empty.");
    if (sizeBytes > maximumMockUploadBytes) throw new MockHttpError(413, "MEDIA_TOO_LARGE", "The demo backend accepts files up to 12 MB.");
    const mediaId = createMockId("med");
    readMockDatabase().uploads.set(mediaId, { mediaId, accountId: account.id, userId, fileName, mimeType, sizeBytes, clientMetadata: readClientMetadata(body.clientMetadata), bytes: null, status: "pending_upload" });
    return respondWithJson(201, {
      mediaId,
      uploadUrl: `/bff/ads/accounts/${encodeURIComponent(account.id)}/creatives/media/${mediaId}/content`,
      uploadHeaders: { "Content-Type": mimeType },
      expiresAt: new Date(Date.now() + uploadUrlLifetimeMilliseconds).toISOString(),
    });
  });

  registerMockRoute("PUT", "/ads/accounts/:accountId/creatives/media/:mediaId/content", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const upload = readMockDatabase().uploads.get(request.params.mediaId ?? "");
    if (!upload || upload.accountId !== account.id || upload.status !== "pending_upload") throw new MockHttpError(404, "MEDIA_NOT_FOUND", "Media not found.");
    const bytes = request.binaryBody ?? new Uint8Array();
    if (bytes.byteLength !== upload.sizeBytes) throw new MockHttpError(400, "UPLOAD_SIZE_MISMATCH", "The uploaded file size does not match.");
    upload.bytes = Buffer.from(bytes);
    return respondWithJson(200, {});
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/creatives/media/:mediaId/complete", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const database = readMockDatabase();
    const upload = database.uploads.get(request.params.mediaId ?? "");
    if (!upload || upload.accountId !== account.id) throw new MockHttpError(404, "MEDIA_NOT_FOUND", "Media not found.");
    if (upload.status !== "pending_upload") return respondWithJson(200, { mediaId: upload.mediaId, status: upload.status });
    const uploadedBytes = upload.bytes;
    if (!uploadedBytes) throw new MockHttpError(409, "UPLOAD_INCOMPLETE", "The file has not finished uploading.");
    upload.status = "processing";
    fileStore.set(upload.mediaId, { mimeType: upload.mimeType, bytes: uploadedBytes });
    const isVideo = upload.mimeType.startsWith("video/");
    database.media.set(upload.mediaId, {
      createdAtEpochMs: Date.now(),
      media: { id: upload.mediaId, kind: isVideo ? "video" : "image", url: `/bff/media/${upload.mediaId}`, posterUrl: null, width: upload.clientMetadata?.width ?? 1080, height: upload.clientMetadata?.height ?? (isVideo ? 1920 : 1080), durationSeconds: isVideo ? (upload.clientMetadata?.durationSeconds ?? 15) : null },
    });
    return respondWithJson(200, { mediaId: upload.mediaId, status: "processing" });
  });

  registerMockRoute("GET", "/media/:mediaId", (request) => {
    requirePrincipal(request);
    const file = fileStore.get(request.params.mediaId ?? "");
    if (!file) throw new MockHttpError(404, "NOT_FOUND", "Media not found.");
    return { status: 200, body: new Uint8Array(file.bytes), contentType: file.mimeType, headers: { "Cache-Control": "private, max-age=3600" } };
  });
}
