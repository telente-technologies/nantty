import { buildAccountApiPath, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { Page } from "@/types/api.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";
import type {
  Ad,
  AdInput,
  AdSet,
  AdSetInput,
  BulkAction,
  BulkActionResult,
  Campaign,
  CampaignDraftResult,
  CampaignDraftSubmission,
  CampaignInput,
  CampaignObjective,
  DeliveryStatus,
  ReviewStatus,
} from "@/types/campaign.type";
import type { ContentSource, Creative, CreativeInput, CreativeSourceType } from "@/types/creative.type";

export interface CardReportRow {
  readonly cardIndex: number;
  readonly headline: string;
  readonly imageUrl: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly ctr: number;
}

export interface CampaignListFilters {
  readonly status?: DeliveryStatus | "";
  readonly objective?: CampaignObjective | "";
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string | null;
}

type EditableStatus = Extract<DeliveryStatus, "active" | "paused">;

export const campaignsApi = {
  listCampaigns: (accountId: string, filters: CampaignListFilters = {}) =>
    sendAdsApiRequest<Page<Campaign>>(buildAccountApiPath(accountId, "/campaigns"), { query: { ...filters, limit: 50 } }),
  createCampaignWithAdSetAndAds: (accountId: string, submission: CampaignDraftSubmission, idempotencyKey: string) =>
    sendAdsApiRequest<CampaignDraftResult>(buildAccountApiPath(accountId, "/campaigns"), { method: "POST", body: submission, idempotencyKey }),
  fetchCampaign: (accountId: string, campaignId: string) => sendAdsApiRequest<Campaign>(buildAccountApiPath(accountId, `/campaigns/${encodeURIComponent(campaignId)}`)),
  updateCampaign: (accountId: string, campaignId: string, changes: Partial<CampaignInput> & { status?: EditableStatus }) =>
    sendAdsApiRequest<Campaign>(buildAccountApiPath(accountId, `/campaigns/${encodeURIComponent(campaignId)}`), { method: "PATCH", body: changes }),
  deleteDraftCampaign: (accountId: string, campaignId: string) => sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/campaigns/${encodeURIComponent(campaignId)}`), { method: "DELETE" }),
  duplicateCampaign: (accountId: string, campaignId: string, idempotencyKey = createClientIdempotencyKey("dup")) =>
    sendAdsApiRequest<Campaign>(buildAccountApiPath(accountId, `/campaigns/${encodeURIComponent(campaignId)}/duplicate`), { method: "POST", idempotencyKey }),
  submitCampaignForReview: (accountId: string, campaignId: string) => sendAdsApiRequest<Campaign>(buildAccountApiPath(accountId, `/campaigns/${encodeURIComponent(campaignId)}/submit`), { method: "POST" }),
  applyBulkAction: (accountId: string, level: "campaign" | "ad_set" | "ad", ids: readonly string[], action: BulkAction) =>
    sendAdsApiRequest<BulkActionResult>(buildAccountApiPath(accountId, "/bulk-actions"), { method: "POST", body: { level, ids, action } }),
  listAdSets: (accountId: string, filters: { campaignId?: string; from?: string; to?: string } = {}) =>
    sendAdsApiRequest<Page<AdSet>>(buildAccountApiPath(accountId, "/ad-sets"), { query: { ...filters, limit: 100 } }),
  createAdSet: (accountId: string, campaignId: string, input: AdSetInput, idempotencyKey = createClientIdempotencyKey("adset")) =>
    sendAdsApiRequest<AdSet>(buildAccountApiPath(accountId, "/ad-sets"), { method: "POST", body: { campaignId, ...input }, idempotencyKey }),
  fetchAdSet: (accountId: string, adSetId: string) => sendAdsApiRequest<AdSet>(buildAccountApiPath(accountId, `/ad-sets/${encodeURIComponent(adSetId)}`)),
  updateAdSet: (accountId: string, adSetId: string, changes: Partial<AdSetInput> & { status?: EditableStatus }) =>
    sendAdsApiRequest<AdSet>(buildAccountApiPath(accountId, `/ad-sets/${encodeURIComponent(adSetId)}`), { method: "PATCH", body: changes }),
  listAds: (accountId: string, filters: { campaignId?: string; adSetId?: string; reviewStatus?: ReviewStatus | ""; from?: string; to?: string } = {}) =>
    sendAdsApiRequest<Page<Ad>>(buildAccountApiPath(accountId, "/ads"), { query: { ...filters, limit: 100 } }),
  createAd: (accountId: string, adSetId: string, input: AdInput, idempotencyKey = createClientIdempotencyKey("ad")) =>
    sendAdsApiRequest<Ad>(buildAccountApiPath(accountId, "/ads"), { method: "POST", body: { adSetId, ...input }, idempotencyKey }),
  fetchAd: (accountId: string, adId: string) => sendAdsApiRequest<Ad>(buildAccountApiPath(accountId, `/ads/${encodeURIComponent(adId)}`)),
  updateAd: (accountId: string, adId: string, changes: Partial<AdInput> & { status?: EditableStatus }) =>
    sendAdsApiRequest<Ad>(buildAccountApiPath(accountId, `/ads/${encodeURIComponent(adId)}`), { method: "PATCH", body: changes }),
  fetchCardReport: (accountId: string, adId: string, range: { from?: string | null; to?: string | null } = {}) =>
    sendAdsApiRequest<{ items: CardReportRow[] }>(buildAccountApiPath(accountId, `/ads/${encodeURIComponent(adId)}/cards/report`), { query: { from: range.from ?? undefined, to: range.to ?? undefined } }),
  appealRejectedAd: (accountId: string, adId: string, message: string) =>
    sendAdsApiRequest<Ad>(buildAccountApiPath(accountId, `/ads/${encodeURIComponent(adId)}/appeal`), { method: "POST", body: { message } }),
  listContentSources: (accountId: string, type: Exclude<CreativeSourceType, "upload">, search = "") =>
    sendAdsApiRequest<Page<ContentSource>>(buildAccountApiPath(accountId, "/content-sources"), { query: { type, search, limit: 24 } }),
  previewCreative: (accountId: string, input: CreativeInput) => sendAdsApiRequest<Creative>(buildAccountApiPath(accountId, "/creatives/preview"), { method: "POST", body: input }),
};
