import type { AccountDeletionSchedule, ConsentKey, ConsentRecord, DataExportRequest, UpdateConsentsInput } from "@/types/privacy.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

interface ConsentsWire {
  readonly data: readonly { readonly consentType: string; readonly status: "granted" | "withdrawn" | "undecided"; readonly decidedAt: string | null }[];
  readonly policyVersion: string;
}

const consentTypeByKey: Readonly<Record<ConsentKey, string>> = { personalization: "personalization", personalizedAds: "advertising", analytics: "analytics", marketing: "marketing" };
const consentKeys = Object.keys(consentTypeByKey) as ConsentKey[];

const toConsentRecord = (wire: ConsentsWire): ConsentRecord => ({
  policyVersion: wire.policyVersion,
  consents: Object.fromEntries(consentKeys.map((key) => [key, wire.data.some((state) => state.consentType === consentTypeByKey[key] && state.status === "granted")])) as Record<ConsentKey, boolean>,
  updatedAt: wire.data.reduce((latest, state) => (state.decidedAt && state.decidedAt > latest ? state.decidedAt : latest), ""),
});

const toConsentDecisions = (consents: UpdateConsentsInput["consents"]) =>
  Object.fromEntries(consentKeys.filter((key) => consents[key] !== undefined).map((key) => [consentTypeByKey[key], consents[key]]));

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
  fetchMyConsents: async () => toConsentRecord(await sendRequestToWebappServer<ConsentsWire>("/api/v1/users/me/consents")),
  updateMyConsents: async (input: UpdateConsentsInput) =>
    toConsentRecord(await sendRequestToWebappServer<ConsentsWire>("/api/v1/users/me/consents", { method: "PUT", body: { ...input, consents: toConsentDecisions(input.consents) } })),
  fetchMyDataExport: async () => toDataExportRequest((await sendListRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports"))[0]),
  requestMyDataExport: async () =>
    toDataExportRequest(await sendRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports", { method: "POST", idempotencyKey: createIdempotencyKey("export") })),
  requestAccountDeletion: (confirmation: string) =>
    sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion-request", { method: "POST", body: { confirm: confirmation === "DELETE", reason: "" } }),
};
