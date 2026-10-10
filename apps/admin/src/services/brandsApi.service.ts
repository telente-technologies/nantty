import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { BrandDetail, BrandDocumentAccess, BrandSummary, OfficialStoreDecisionAction } from "@/types/brands.type";
import type { IpClaimDecisionAction, IpClaimDetail, IpClaimSummary } from "@/types/ipClaims.type";

export interface BrandDirectoryFilters {
  readonly search?: string;
  readonly official?: string;
  readonly country?: string;
  readonly cursor?: string;
}

export function fetchBrandDirectory(filters: BrandDirectoryFilters, signal?: AbortSignal): Promise<PagedList<BrandSummary>> {
  return sendAdminApiRequest("/admin/brands", { query: { ...filters }, signal });
}

export function fetchBrandDetail(brandId: string, signal?: AbortSignal): Promise<BrandDetail> {
  return sendAdminApiRequest(`/admin/brands/${encodeURIComponent(brandId)}`, { signal });
}

export function openBrandDocument(brandId: string, documentId: string, signal?: AbortSignal): Promise<BrandDocumentAccess> {
  return sendAdminApiRequest(`/admin/brands/${encodeURIComponent(brandId)}/documents/${encodeURIComponent(documentId)}`, { signal });
}

export function decideOfficialStoreStatus(brandId: string, action: OfficialStoreDecisionAction, reason: string): Promise<BrandDetail> {
  return sendAdminApiRequest(`/admin/brands/${encodeURIComponent(brandId)}/official-status/${action}`, { method: "POST", body: { reason } });
}

export interface IpClaimFilters {
  readonly search?: string;
  readonly status?: string;
  readonly type?: string;
  readonly cursor?: string;
}

export function fetchIpClaims(filters: IpClaimFilters, signal?: AbortSignal): Promise<PagedList<IpClaimSummary>> {
  return sendAdminApiRequest("/admin/ip-claims", { query: { ...filters }, signal });
}

export function fetchIpClaimDetail(claimId: string, signal?: AbortSignal): Promise<IpClaimDetail> {
  return sendAdminApiRequest(`/admin/ip-claims/${encodeURIComponent(claimId)}`, { signal });
}

export interface IpClaimDecisionResult {
  readonly claim: IpClaimDetail;
  readonly sellerStrikeCount: number;
  readonly isRepeatInfringer: boolean;
}

export function decideIpClaim(claimId: string, action: IpClaimDecisionAction, input: { reason: string; addStrike?: boolean }): Promise<IpClaimDecisionResult> {
  return sendAdminApiRequest(`/admin/ip-claims/${encodeURIComponent(claimId)}/${action}`, { method: "POST", body: input });
}
