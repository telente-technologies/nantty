import type { BusinessDocumentKind, BusinessDocumentsState } from "@/types/trust.type";

import { api } from "./apiClient.service";

export const businessDocumentsService = {
  fetchMyBusinessDocuments: () => api.get<BusinessDocumentsState>("/api/v1/seller/business-documents"),
  submitBusinessDocument: (kind: BusinessDocumentKind, fileUrl: string) =>
    api.put<BusinessDocumentsState>(`/api/v1/seller/business-documents/${kind}`, { fileUrl }),
};
