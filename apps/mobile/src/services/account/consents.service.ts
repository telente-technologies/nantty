import { ApiError } from "@/errors/api.error";
import type { AccountDeletionRequest, ConsentKey, ConsentRecord, DataExportRequest, ProductInteractionRecord, UpdateConsentsInput } from "@/types";

import type { MarketingPreferences } from "@/types/trust.type";

import { api } from "../core/apiClient.service";

interface DataExportWire {
  readonly status: "requested" | "processing" | "ready" | "failed" | "expired";
  readonly requestedAt: string;
  readonly downloadUrl: string | null;
  readonly expiresAt: string | null;
}

export interface ConsentsWire {
  readonly data: readonly { readonly consentType: string; readonly status: string; readonly decidedAt: string | null }[];
  readonly policyVersion: string;
}

const toConsentRecord = (wire: ConsentsWire): ConsentRecord => {
  const granted = (key: ConsentKey) => wire.data.some((state) => state.consentType === key && state.status === "granted");
  return {
    policyVersionId: wire.policyVersion,
    consents: { personalization: granted("personalization"), advertising: granted("advertising"), analytics: granted("analytics"), marketing: granted("marketing") },
    updatedAt: wire.data.map((state) => state.decidedAt ?? "").sort().at(-1) ?? "",
  };
};

const toDataExportRequest = (wire: DataExportWire | undefined): DataExportRequest =>
  !wire || wire.status === "failed" || wire.status === "expired"
    ? { status: "none", requestedAt: null, downloadUrl: null, expiresAt: null }
    : { status: wire.status, requestedAt: wire.requestedAt, downloadUrl: wire.downloadUrl, expiresAt: wire.expiresAt };

const newExportIdempotencyKey = () => `export_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const consentsService = {
  fetchMyConsents: async () => toConsentRecord(await api.get<ConsentsWire>("/api/v1/users/me/consents")),
  updateMyConsents: async (input: UpdateConsentsInput) => toConsentRecord(await api.put<ConsentsWire>("/api/v1/users/me/consents", input)),
  fetchMyTaggingSettings: () => api.get<{ readonly allowTagging: boolean }>("/api/v1/me/tagging-settings"),
  updateMyTaggingSettings: (allowTagging: boolean) => api.put<{ readonly allowTagging: boolean }>("/api/v1/me/tagging-settings", { allowTagging }),
  fetchMyMarketingPreferences: () => api.get<MarketingPreferences>("/api/v1/users/me/marketing-preferences"),
  updateMyMarketingPreferences: (preferences: MarketingPreferences) => api.put<MarketingPreferences>("/api/v1/users/me/marketing-preferences", preferences),
  fetchMyDataExport: async () => toDataExportRequest((await api.getList<DataExportWire>("/api/v1/users/me/data-exports"))[0]),
  requestMyDataExport: async () => toDataExportRequest(await api.post<DataExportWire>("/api/v1/users/me/data-exports", undefined, { idempotencyKey: newExportIdempotencyKey() })),
  fetchAccountDeletionStatus: async (): Promise<AccountDeletionRequest | null> => {
    try {
      const record = await api.get<AccountDeletionRequest>("/api/v1/users/me/deletion-request");
      return record.status === "scheduled" ? record : null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  requestAccountDeletion: (confirmation: string) => api.post<AccountDeletionRequest>("/api/v1/users/me/deletion-request", { confirm: confirmation === "DELETE", reason: "" }),
  cancelAccountDeletion: () => api.post<AccountDeletionRequest>("/api/v1/users/me/deletion-request/cancel", {}),
  sendProductInteractions: (events: readonly ProductInteractionRecord[]) => api.post<void>("/api/v1/analytics/product-interactions", { events }),
};
