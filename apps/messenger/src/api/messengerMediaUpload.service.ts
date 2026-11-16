import type { MessengerRequest } from "./messengerChat.service";

interface UploadSession {
  readonly uploadId: string;
  readonly mode: "single" | "multipart";
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

export interface MediaUploadRequest {
  readonly fileName: string;
  readonly mimeType: string;
  readonly purpose: "story";
  readonly sha256?: string;
}

export type UploadBinary = (url: string, bytes: Uint8Array, headers?: Readonly<Record<string, string>>) => Promise<void>;

export async function uploadMediaBytes(
  request: MessengerRequest,
  metadata: MediaUploadRequest,
  bytes: Uint8Array,
  uploadBinary: UploadBinary,
): Promise<string> {
  if (bytes.byteLength === 0) throw new Error("The selected media file is empty.");
  const session = await request<UploadSession>("/api/v1/media/uploads", {
    method: "POST",
    body: { ...metadata, sizeBytes: bytes.byteLength },
  });
  if (typeof session.uploadId !== "string" || session.uploadId.trim().length === 0) throw new Error("The media upload could not be started. Please try again.");
  try {
    if (session.mode === "single") {
      if (!session.url) throw new Error("The media upload could not be started. Please try again.");
      await uploadBinary(session.url, bytes, session.headers);
    } else if (session.mode === "multipart") {
      if (!Number.isSafeInteger(session.chunkSizeBytes) || session.chunkSizeBytes <= 0 || !Number.isSafeInteger(session.totalChunks) || session.totalChunks <= 0) {
        throw new Error("The media upload returned an invalid chunk layout.");
      }
      const expectedChunks = Math.ceil(bytes.byteLength / session.chunkSizeBytes);
      if (expectedChunks !== session.totalChunks) throw new Error("The media upload returned an incomplete chunk layout.");
      if (session.uploadedChunks.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= session.totalChunks)) throw new Error("The media upload returned an invalid chunk state.");
      const uploaded = new Set(session.uploadedChunks);
      for (let index = 0; index < session.totalChunks; index++) {
        if (uploaded.has(index)) continue;
        const target = await request<{ readonly url: string }>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}/chunks/${index}/url`);
        const chunk = bytes.subarray(index * session.chunkSizeBytes, Math.min(bytes.byteLength, (index + 1) * session.chunkSizeBytes));
        await uploadBinary(target.url, chunk);
      }
    } else {
      throw new Error("The media upload returned an unsupported mode.");
    }
    const completed = await request<{ readonly mediaId: string }>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST" });
    if (!completed.mediaId) throw new Error("The uploaded media could not be confirmed.");
    return completed.mediaId;
  } catch (error) {
    await request<void>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}
