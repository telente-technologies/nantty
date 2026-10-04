import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { defaultRankingSettings } from "../../../integrations/adminRankingSettings.integration.js";
import type { RankingSettings, TrendRemoval } from "../../../interfaces/rankingSettings.interface.js";

const countryNames: Readonly<Record<string, string>> = { NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa", GB: "the United Kingdom", US: "the United States" };

export const describeScope = (country: string | null): string => (country === null ? "Worldwide" : `in ${countryNames[country] ?? country}`);

export async function resolveViewerCountry(context: HandlerContext, viewerId: string | undefined, requestedCountry: string | undefined): Promise<string | null> {
  if (requestedCountry !== undefined && /^[A-Z]{2}$/.test(requestedCountry)) return requestedCountry;
  if (viewerId === undefined || context.authorRanking === undefined) return null;
  const profiles = await context.authorRanking.findAuthorRankingProfiles([viewerId]);
  return profiles.get(viewerId)?.countryCode ?? null;
}

export async function readRankingSettings(context: HandlerContext): Promise<RankingSettings> {
  return context.rankingSettings === undefined ? defaultRankingSettings : context.rankingSettings.read();
}

export function isRemovedForScope(removals: readonly TrendRemoval[], kinds: readonly TrendRemoval["kind"][], key: string, country: string | null): boolean {
  return removals.some((removal) => kinds.includes(removal.kind) && removal.key === key && (removal.country === "" || removal.country === country));
}
