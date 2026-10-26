import type { AttachmentPointer } from "@nantty/chat-crypto";

import { useDocumentUploadsStore } from "@/store/documentUploads.store";
import type { ID, MessageDocument } from "@/types";

import { uploadEncryptedAttachment } from "../chatCrypto/encryptedAttachments.service";

export class DocumentUploadCancelledError extends Error {}

const cancelledMessageIds = new Set<string>();

export const cancelDocumentUpload = (messageId: string) => {
  cancelledMessageIds.add(messageId);
  useDocumentUploadsStore.getState().setUpload(messageId, { fraction: 0, wasCancelled: true });
};

export async function uploadDocumentWithProgress(messageId: string, document: MessageDocument): Promise<{ readonly mediaId: ID; readonly pointer: AttachmentPointer }> {
  const { setUpload, clearUpload } = useDocumentUploadsStore.getState();
  if (!document.url) throw new Error("The document file is missing.");
  cancelledMessageIds.delete(messageId);
  setUpload(messageId, { fraction: 0, wasCancelled: false });
  try {
    const uploaded = await uploadEncryptedAttachment(
      document.url,
      { contentType: document.mimeType, fileName: document.fileName, pageCount: document.pageCount ?? null },
      "chat",
      (fraction) => setUpload(messageId, { fraction, wasCancelled: false }),
      () => cancelledMessageIds.has(messageId),
    );
    clearUpload(messageId);
    return uploaded;
  } catch (error) {
    if (cancelledMessageIds.has(messageId)) throw new DocumentUploadCancelledError();
    throw error;
  }
}
