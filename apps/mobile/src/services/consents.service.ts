import type { AccountDeletionRequest, ConsentRecord, DataExportRequest, ProductInteractionRecord, UpdateConsentsInput } from "@/types";

import type { MarketingPreferences } from "@/types/trust.type";

import { api } from "./apiClient.service";

interface DataExportWire {
  readonly status: "requested" | "processing" | "ready" | "failed" | "expired";
  readonly requestedAt: string;
  readonly downloadUrl: string | null;
  readonly expiresAt: string | null;
}

const toDataExportRequest = (wire: DataExportWire | undefined): DataExportRequest =>
  !wire || wire.status === "failed" || wire.status === "expired"
    ? { status: "none", requestedAt: null, downloadUrl: null, expiresAt: null }
    : { status: wire.status, requestedAt: wire.requestedAt, downloadUrl: wire.downloadUrl, expiresAt: wire.expiresAt };

const newExportIdempotencyKey = () => `export_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const consentsService = {
  fetchMyConsents: () => api.get<ConsentRecord>("/api/v1/users/me/consents"),
  updateMyConsents: (input: UpdateConsentsInput) => api.put<ConsentRecord>("/api/v1/users/me/consents", input),
  fetchMyMarketingPreferences: () => api.get<MarketingPreferences>("/api/v1/users/me/marketing-preferences"),
  updateMyMarketingPreferences: (preferences: MarketingPreferences) => api.put<MarketingPreferences>("/api/v1/users/me/marketing-preferences", preferences),
  fetchMyDataExport: async () => toDataExportRequest((await api.getList<DataExportWire>("/api/v1/users/me/data-exports"))[0]),
  requestMyDataExport: async () => toDataExportRequest(await api.post<DataExportWire>("/api/v1/users/me/data-exports", undefined, { idempotencyKey: newExportIdempotencyKey() })),
  requestAccountDeletion: (confirmation: string) => api.post<AccountDeletionRequest>("/api/v1/users/me/deletion-request", { confirm: confirmation === "DELETE", reason: "" }),
  sendProductInteractions: (events: readonly ProductInteractionRecord[]) => api.post<void>("/api/v1/analytics/product-interactions", { events }),
};
