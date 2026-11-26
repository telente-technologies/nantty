import type { AccountDeletionSchedule, ConsentKey, ConsentRecord, DataExportRequest, UpdateConsentsInput } from "@/types/privacy.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer, WebappRequestError } from "./clientApi.service";

interface ConsentsWire {
  readonly data: readonly { readonly consentType: string; readonly status: "granted" | "withdrawn" | "undecided"; readonly decidedAt: string | null }[];
  readonly policyVersion: string;
}

export interface BusinessMessagingConsent {
  readonly id: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly applicationId: string;
  readonly applicationName: string;
  readonly storeId?: string;
  readonly scopes: readonly string[];
  readonly status: "active" | "revoked";
  readonly grantedAt: string;
  readonly revokedAt?: string;
}

export interface BusinessMessagingApplicationPreview {
  readonly applicationId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly applicationName: string;
  readonly requestedScopes: readonly string[];
}

export interface BusinessMessagingConsentPreview {
  readonly applicationId: string;
  readonly applicationName: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly requestedScopes: readonly string[];
  readonly availableScopes: readonly string[];
}

export interface BusinessMessagingConsentAuthorizationRequest {
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly state: string;
}

export interface BusinessMessagingConsentGrant extends BusinessMessagingConsent {
  readonly authorizationRedirectUrl?: string;
}

export interface BusinessMessagingConsentDenial {
  readonly authorizationRedirectUrl: string;
}

export interface BusinessMessagingStoreAuthorization extends BusinessMessagingConsent {
  readonly storeId: string;
  readonly storeName: string;
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

export interface TaggingSettings {
  readonly allowTagging: boolean;
}

export const privacyService = {
  fetchMyConsents: async () => toConsentRecord(await sendRequestToWebappServer<ConsentsWire>("/api/v1/users/me/consents")),
  updateMyConsents: async (input: UpdateConsentsInput) =>
    toConsentRecord(await sendRequestToWebappServer<ConsentsWire>("/api/v1/users/me/consents", { method: "PUT", body: { ...input, consents: toConsentDecisions(input.consents) } })),
  fetchBusinessMessagingConsents: async () => (await sendRequestToWebappServer<{ readonly consents: readonly BusinessMessagingConsent[] }>("/api/v1/account/business-messaging/consents")).consents,
  revokeBusinessMessagingConsent: (consentId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/account/business-messaging/consents/${encodeURIComponent(consentId)}`, { method: "DELETE" }),
  previewBusinessMessagingApplication: (applicationId: string) =>
    sendRequestToWebappServer<BusinessMessagingApplicationPreview>(`/api/v1/account/business-messaging/applications/${encodeURIComponent(applicationId)}`),
  previewBusinessMessagingConsent: (applicationId: string, storeId: string, authorization?: BusinessMessagingConsentAuthorizationRequest | null) =>
    sendRequestToWebappServer<BusinessMessagingConsentPreview>(`/api/v1/account/business-messaging/applications/${encodeURIComponent(applicationId)}/stores/${encodeURIComponent(storeId)}/consent-preview`, {
      query: authorization ? { redirect_uri: authorization.redirectUri, code_challenge: authorization.codeChallenge, code_challenge_method: authorization.codeChallengeMethod, state: authorization.state } : undefined,
    }),
  grantBusinessMessagingConsent: (input: Pick<BusinessMessagingConsent, "organizationId" | "applicationId" | "storeId" | "scopes"> & { readonly authorization?: BusinessMessagingConsentAuthorizationRequest }) =>
    sendRequestToWebappServer<BusinessMessagingConsentGrant>("/api/v1/account/business-messaging/consents", { method: "POST", body: input }),
  denyBusinessMessagingConsent: (applicationId: string, storeId: string, authorization: BusinessMessagingConsentAuthorizationRequest) =>
    sendRequestToWebappServer<BusinessMessagingConsentDenial>(`/api/v1/account/business-messaging/applications/${encodeURIComponent(applicationId)}/stores/${encodeURIComponent(storeId)}/consent-denial`, {
      method: "POST", body: { authorization },
    }),
  fetchBusinessMessagingAuthorizations: async () => (await sendRequestToWebappServer<{ readonly authorizations: readonly BusinessMessagingStoreAuthorization[] }>("/api/v1/account/business-messaging/authorizations")).authorizations,
  grantBusinessMessagingAuthorization: (input: Pick<BusinessMessagingStoreAuthorization, "organizationId" | "applicationId" | "storeId" | "scopes">) =>
    sendRequestToWebappServer<BusinessMessagingStoreAuthorization>("/api/v1/account/business-messaging/authorizations", { method: "POST", body: input }),
  revokeBusinessMessagingAuthorization: (authorizationId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/account/business-messaging/authorizations/${encodeURIComponent(authorizationId)}`, { method: "DELETE" }),
  fetchMyTaggingSettings: () => sendRequestToWebappServer<TaggingSettings>("/api/v1/me/tagging-settings"),
  updateMyTaggingSettings: (allowTagging: boolean) =>
    sendRequestToWebappServer<TaggingSettings>("/api/v1/me/tagging-settings", { method: "PUT", body: { allowTagging } }),
  fetchMyDataExport: async () => toDataExportRequest((await sendListRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports"))[0]),
  requestMyDataExport: async () =>
    toDataExportRequest(await sendRequestToWebappServer<DataExportWire>("/api/v1/users/me/data-exports", { method: "POST", idempotencyKey: createIdempotencyKey("export") })),
  fetchAccountDeletionStatus: async (): Promise<AccountDeletionSchedule | null> => {
    try {
      const record = await sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion-request");
      return record.status === "scheduled" ? record : null;
    } catch (error) {
      if (error instanceof WebappRequestError && error.status === 404) return null;
      throw error;
    }
  },
  requestAccountDeletion: (confirmation: string) =>
    sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion-request", { method: "POST", body: { confirm: confirmation === "DELETE", reason: "" } }),
  cancelAccountDeletion: () =>
    sendRequestToWebappServer<AccountDeletionSchedule>("/api/v1/users/me/deletion-request/cancel", { method: "POST", body: {} }),
};
