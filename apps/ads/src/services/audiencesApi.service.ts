import { buildAccountApiPath, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { Page } from "@/types/api.type";
import type {
  AudienceEstimate,
  AudienceEstimateRequest,
  Behaviour,
  CreateCustomAudienceRequest,
  CustomAudience,
  CustomAudienceType,
  CustomerListUploadRequest,
  LocationTarget,
  Topic,
} from "@/types/audience.type";

export const audiencesApi = {
  searchLocations: (search: string, countryCode = "", signal?: AbortSignal) =>
    sendAdsApiRequest<{ items: LocationTarget[] }>("/ads/locations", { query: { search, countryCode }, signal }),
  listTopics: () => sendAdsApiRequest<Topic[]>("/topics"),
  listBehaviours: () => sendAdsApiRequest<{ items: Behaviour[] }>("/ads/behaviours"),
  listCustomAudiences: (accountId: string, type: CustomAudienceType | "" = "") =>
    sendAdsApiRequest<Page<CustomAudience>>(buildAccountApiPath(accountId, "/audiences"), { query: { type, limit: 100 } }),
  createCustomAudience: (accountId: string, request: CreateCustomAudienceRequest) =>
    sendAdsApiRequest<CustomAudience>(buildAccountApiPath(accountId, "/audiences"), { method: "POST", body: request }),
  uploadHashedCustomerList: (accountId: string, request: CustomerListUploadRequest, idempotencyKey: string) =>
    sendAdsApiRequest<CustomAudience>(buildAccountApiPath(accountId, "/audiences/customer-lists"), { method: "POST", body: request, idempotencyKey }),
  renameCustomAudience: (accountId: string, audienceId: string, name: string) =>
    sendAdsApiRequest<CustomAudience>(buildAccountApiPath(accountId, `/audiences/${encodeURIComponent(audienceId)}`), { method: "PATCH", body: { name } }),
  deleteCustomAudience: (accountId: string, audienceId: string) =>
    sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/audiences/${encodeURIComponent(audienceId)}`), { method: "DELETE" }),
  estimateAudience: (accountId: string, request: AudienceEstimateRequest, signal?: AbortSignal) =>
    sendAdsApiRequest<AudienceEstimate>(buildAccountApiPath(accountId, "/estimates/audience"), { method: "POST", body: request, signal }),
};
