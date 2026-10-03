import { create } from "zustand";

export interface DocumentUploadProgress {
  readonly fraction: number;
  readonly wasCancelled: boolean;
}

interface DocumentUploadsState {
  readonly uploadsByMessageId: Readonly<Record<string, DocumentUploadProgress>>;
  readonly setUpload: (messageId: string, progress: DocumentUploadProgress) => void;
  readonly clearUpload: (messageId: string) => void;
}

export const useDocumentUploadsStore = create<DocumentUploadsState>((set) => ({
  uploadsByMessageId: {},
  setUpload: (messageId, progress) => set((state) => ({ uploadsByMessageId: { ...state.uploadsByMessageId, [messageId]: progress } })),
  clearUpload: (messageId) =>
    set((state) => {
      const { [messageId]: _removed, ...rest } = state.uploadsByMessageId;
      return { uploadsByMessageId: rest };
    }),
}));

export const useDocumentUploadProgress = (messageId: string) => useDocumentUploadsStore((state) => state.uploadsByMessageId[messageId]);
