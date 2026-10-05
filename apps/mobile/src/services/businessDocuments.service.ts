import { shouldUseMockForPath } from "@/config/api.config";
import type { BusinessDocumentKind, BusinessDocumentsState } from "@/types/trust.type";

import { api } from "./apiClient.service";

interface BusinessDocumentUploadIntent {
  readonly documentId: string;
  readonly uploadUrl: string;
  readonly headers: Record<string, string>;
}

const documentsPath = "/api/v1/seller/business-documents";

export const businessDocumentsService = {
  fetchMyBusinessDocuments: () => api.get<BusinessDocumentsState>(documentsPath),
  submitBusinessDocument: async (kind: BusinessDocumentKind, localUri: string) => {
    if (shouldUseMockForPath(documentsPath)) return api.put<BusinessDocumentsState>(`${documentsPath}/${kind}`, { fileUrl: localUri });
    const file = await (await fetch(localUri)).blob();
    const intent = await api.post<BusinessDocumentUploadIntent>(`${documentsPath}/${kind}/upload-intents`, {
      fileName: localUri.split("/").pop() ?? `${kind}.jpg`,
      contentType: file.type || "image/jpeg",
      sizeBytes: file.size,
    });
    const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file });
    if (!upload.ok) throw new Error("Couldn't upload your document. Try again.");
    return api.put<BusinessDocumentsState>(`${documentsPath}/${kind}`, { documentId: intent.documentId });
  },
};
