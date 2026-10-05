import type { AccountDeletionSchedule, ConsentRecord, DataExportRequest, UpdateConsentsInput } from "@/types/privacy.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

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

export const privacyService = {
  fetchMyConsents: () => sendRequestToWebappServer<ConsentRecord>("/api/v1/users/me/consents"),
  updateMyConsents: (input: UpdateConsentsInput) => sendRequestToWebappServer<ConsentRecord>("/api/v1/users/me/consents", { method: "PUT", body: input }),
  fetchMyDataExport: async () => toDataExportRequest((await sendListRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports"))[0]),
  requestMyDataExport: async () =>
    toDataExportRequest(await sendRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports", { method: "POST", idempotencyKey: createIdempotencyKey("export") })),
  requestAccountDeletion: (confirmation: string) =>
    sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion-request", { method: "POST", body: { confirm: confirmation === "DELETE", reason: "" } }),
};
