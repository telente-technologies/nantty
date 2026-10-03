import type { AccountDeletionRequest, ConsentRecord, DataExportRequest, ProductInteractionRecord, UpdateConsentsInput } from "@/types";

import { api } from "./apiClient.service";

export const consentsService = {
  fetchMyConsents: () => api.get<ConsentRecord>("/api/v1/users/me/consents"),
  updateMyConsents: (input: UpdateConsentsInput) => api.put<ConsentRecord>("/api/v1/users/me/consents", input),
  fetchMyDataExport: () => api.get<DataExportRequest>("/api/v1/privacy/exports/latest"),
  requestMyDataExport: () => api.post<DataExportRequest>("/api/v1/privacy/exports/latest"),
  requestAccountDeletion: (confirmation: string) => api.post<AccountDeletionRequest>("/api/v1/privacy/deletion", { confirmation }),
  sendProductInteractions: (events: readonly ProductInteractionRecord[]) => api.post<void>("/api/v1/analytics/product-interactions", { events }),
};
