import type { AccountDeletionSchedule, ConsentRecord, DataExportRequest, UpdateConsentsInput } from "@/types/privacy.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const privacyService = {
  fetchMyConsents: () => sendRequestToWebappServer<ConsentRecord>("/api/v1/users/me/consents"),
  updateMyConsents: (input: UpdateConsentsInput) => sendRequestToWebappServer<ConsentRecord>("/api/v1/users/me/consents", { method: "PUT", body: input }),
  fetchMyDataExport: () => sendRequestToWebappServer<DataExportRequest>("/api/v1/users/me/data-export"),
  requestMyDataExport: () => sendRequestToWebappServer<DataExportRequest>("/api/v1/users/me/data-export", { method: "POST" }),
  requestAccountDeletion: (confirmation: string) => sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion", { method: "POST", body: { confirmation } }),
};
