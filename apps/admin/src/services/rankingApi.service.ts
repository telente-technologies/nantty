import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { VersionedCollectionEndpoint } from "@/services/configurationApi.service";
import type { FeedRankingPolicy, TrendingModerationSetting, TrendRemoval } from "@/types/ranking.type";
import type { PagedList } from "@/types/api.type";
import type { SuspensionCaseSummary } from "@/types/suspensions.type";

export const feedRankingEndpoint: VersionedCollectionEndpoint<FeedRankingPolicy> = { basePath: "/admin/config" };
export const feedRankingRecordId = "feed.ranking";

export function fetchTrendingModeration(signal?: AbortSignal): Promise<TrendingModerationSetting> {
  return sendAdminApiRequest("/admin/trending/moderation", { signal });
}

export function saveTrendingModeration(input: { readonly expectedVersion: number; readonly reason: string; readonly removals: readonly TrendRemoval[] }): Promise<TrendingModerationSetting> {
  return sendAdminApiRequest("/admin/trending/moderation", { method: "PUT", body: { expectedVersion: input.expectedVersion, reason: input.reason, value: { removals: input.removals } } });
}

export function fetchManipulationFlags(status: string, signal?: AbortSignal): Promise<PagedList<SuspensionCaseSummary>> {
  return sendAdminApiRequest("/admin/suspensions/cases", { query: { status, source: "PYTHON_SUGGESTION", modelVersion: "engagement_integrity" }, signal });
}
