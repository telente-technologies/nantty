import { useDocumentUploadsStore } from "@/store/documentUploads.store";
import type { ID, MessageDocument } from "@/types";

import { mediaUploadTransport, readChunkBytesFromLocalFile } from "./mediaUploadTransport.service";

export class DocumentUploadCancelledError extends Error {}

const cancelledMessageIds = new Set<string>();

export const cancelDocumentUpload = (messageId: string) => {
  cancelledMessageIds.add(messageId);
  useDocumentUploadsStore.getState().setUpload(messageId, { fraction: 0, wasCancelled: true });
};

export async function uploadDocumentWithProgress(messageId: string, document: MessageDocument): Promise<ID> {
  const { setUpload, clearUpload } = useDocumentUploadsStore.getState();
  if (!document.url) throw new Error("The document file is missing.");
  cancelledMessageIds.delete(messageId);
  setUpload(messageId, { fraction: 0, wasCancelled: false });
  const session = await mediaUploadTransport.createUploadSession({ fileName: document.fileName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, purpose: "chat" });
  let sentBytes = 0;
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex++) {
    if (cancelledMessageIds.has(messageId)) {
      await mediaUploadTransport.abortUploadSession(session.uploadId).catch(() => undefined);
      throw new DocumentUploadCancelledError();
    }
    if (session.uploadedChunks.includes(chunkIndex)) continue;
    const offset = chunkIndex * session.chunkSizeBytes;
    const chunk = await readChunkBytesFromLocalFile(document.url, offset, Math.min(session.chunkSizeBytes, document.sizeBytes - offset));
    await mediaUploadTransport.uploadChunk(session.uploadId, chunkIndex, chunk, (bytes) => setUpload(messageId, { fraction: Math.min(0.99, (sentBytes + bytes) / document.sizeBytes), wasCancelled: false }));
    sentBytes += chunk.byteLength;
  }
  const completed = await mediaUploadTransport.completeUploadSession(session.uploadId);
  clearUpload(messageId);
  return completed.mediaId;
}
