import { authorRankingTiers, defaultOfficialEditorialBoost, defaultTierBoost, rankingSettingsCacheMilliseconds, type AuthorRankingTier } from "../constants/ranking.constant.js";
import type { RankingSettings, RankingSettingsSource, TrendRemoval } from "../interfaces/rankingSettings.interface.js";
import { clampBoostPolicyToHardCaps } from "../utils/rankingBoostPolicy.util.js";

export const defaultRankingSettings: RankingSettings = {
  boostPolicy: { version: 0, tierBoosts: defaultTierBoost, officialEditorialBoost: defaultOfficialEditorialBoost },
  trendRemovals: [],
};

export const staticRankingSettings: RankingSettingsSource = { read: async () => defaultRankingSettings };

interface SettingView {
  readonly value?: unknown;
  readonly version?: unknown;
}

const basisPointsToMultiplier = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value / 10_000 : undefined);

export function parseFeedRankingSetting(view: SettingView | undefined): RankingSettings["boostPolicy"] {
  const value = (view?.value ?? {}) as { tierBoostBps?: Record<string, unknown>; officialEditorialBoostBps?: unknown };
  const tierBoosts = { ...defaultTierBoost } as Record<AuthorRankingTier, number>;
  for (const tier of authorRankingTiers) {
    const parsed = basisPointsToMultiplier(value.tierBoostBps?.[tier]);
    if (parsed !== undefined) tierBoosts[tier] = parsed;
  }
  return clampBoostPolicyToHardCaps({ version: typeof view?.version === "number" ? view.version : 0, tierBoosts, officialEditorialBoost: basisPointsToMultiplier(value.officialEditorialBoostBps) ?? defaultOfficialEditorialBoost });
}

export function parseTrendingModerationSetting(view: SettingView | undefined): TrendRemoval[] {
  const removals = (view?.value as { removals?: unknown } | undefined)?.removals;
  if (!Array.isArray(removals)) return [];
  return removals.flatMap((entry: Record<string, unknown>) =>
    (entry?.["kind"] === "hashtag" || entry?.["kind"] === "topic" || entry?.["kind"] === "headline") && typeof entry["key"] === "string"
      ? [{ kind: entry["kind"], key: entry["key"], country: typeof entry["country"] === "string" ? entry["country"] : "", reason: typeof entry["reason"] === "string" ? entry["reason"] : "other" }]
      : []);
}

export function createAdminRankingSettingsSource(options: { readonly baseUrl: string; readonly internalToken: string; readonly fetchImplementation?: typeof fetch; readonly now?: () => number }): RankingSettingsSource {
  const send = options.fetchImplementation ?? fetch;
  const now = options.now ?? Date.now;
  let cached: { readonly settings: RankingSettings; readonly expiresAt: number } | undefined;
  const readSetting = async (key: string): Promise<SettingView | undefined> => {
    const response = await send(new URL(`/api/v1/internal/platform-config/${key}`, options.baseUrl), { headers: { "x-internal-token": options.internalToken }, signal: AbortSignal.timeout(500) });
    if (!response.ok) throw new Error(`platform config ${key} responded ${response.status}`);
    return (await response.json()) as SettingView;
  };
  return {
    async read() {
      if (cached !== undefined && cached.expiresAt > now()) return cached.settings;
      try {
        const [ranking, moderation] = await Promise.all([readSetting("feed.ranking"), readSetting("trending.moderation")]);
        const settings: RankingSettings = { boostPolicy: parseFeedRankingSetting(ranking), trendRemovals: parseTrendingModerationSetting(moderation) };
        cached = { settings, expiresAt: now() + rankingSettingsCacheMilliseconds };
        return settings;
      } catch {
        const stale = cached?.settings ?? defaultRankingSettings;
        cached = { settings: stale, expiresAt: now() + rankingSettingsCacheMilliseconds / 4 };
        return stale;
      }
    },
  };
}
