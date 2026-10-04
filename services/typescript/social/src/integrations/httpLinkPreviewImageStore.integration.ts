import type { LinkPreviewImageStore } from "../interfaces/linkPreviewImageStore.interface.js";

interface UploadIntentResponse {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly publicUrl: string;
}

export function createHttpLinkPreviewImageStore(source: { readonly baseUrl: string; readonly internalToken: string }, ownerAccountId: string, timeoutMs = 8000): LinkPreviewImageStore {
  const internalHeaders = { "content-type": "application/json", "x-internal-token": source.internalToken };
  return {
    async storeImage(bytes, contentType) {
      const intentResponse = await fetch(new URL("/internal/v1/media/intents", source.baseUrl), {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ accountId: ownerAccountId, purpose: "post", contentType, sizeBytes: bytes.byteLength, fileName: "link-preview" }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!intentResponse.ok) throw new Error(`media intent responded ${intentResponse.status}`);
      const intent = (await intentResponse.json()) as UploadIntentResponse;
      const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: { ...intent.headers, "content-type": contentType }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(timeoutMs) });
      if (!upload.ok) throw new Error(`media upload responded ${upload.status}`);
      const completion = await fetch(new URL(`/internal/v1/media/${encodeURIComponent(intent.mediaId)}/complete`, source.baseUrl), {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ accountId: ownerAccountId }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!completion.ok) throw new Error(`media completion responded ${completion.status}`);
      return { mediaId: intent.mediaId, url: intent.publicUrl };
    },
  };
}
