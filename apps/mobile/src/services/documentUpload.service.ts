import { useDocumentUploadsStore } from "@/store/documentUploads.store";

const UPLOAD_TICK_MS = 200;
const SIMULATED_BYTES_PER_SECOND = 2 * 1024 * 1024;
const MINIMUM_SIMULATED_UPLOAD_MS = 1200;
const MAXIMUM_SIMULATED_UPLOAD_MS = 6000;

export class DocumentUploadCancelledError extends Error {}

const cancelHandlersByMessageId = new Map<string, () => void>();

export const cancelDocumentUpload = (messageId: string) => cancelHandlersByMessageId.get(messageId)?.();

export function uploadDocumentWithProgress(messageId: string, sizeBytes: number): Promise<void> {
  const totalMs = Math.min(MAXIMUM_SIMULATED_UPLOAD_MS, Math.max(MINIMUM_SIMULATED_UPLOAD_MS, (sizeBytes / SIMULATED_BYTES_PER_SECOND) * 1000));
  const { setUpload, clearUpload } = useDocumentUploadsStore.getState();
  setUpload(messageId, { fraction: 0, wasCancelled: false });
  return new Promise((resolve, reject) => {
    let elapsedMs = 0;
    const timer = setInterval(() => {
      elapsedMs += UPLOAD_TICK_MS;
      if (elapsedMs < totalMs) {
        setUpload(messageId, { fraction: elapsedMs / totalMs, wasCancelled: false });
        return;
      }
      clearInterval(timer);
      cancelHandlersByMessageId.delete(messageId);
      clearUpload(messageId);
      resolve();
    }, UPLOAD_TICK_MS);
    cancelHandlersByMessageId.set(messageId, () => {
      clearInterval(timer);
      cancelHandlersByMessageId.delete(messageId);
      setUpload(messageId, { fraction: 0, wasCancelled: true });
      reject(new DocumentUploadCancelledError());
    });
  });
}
