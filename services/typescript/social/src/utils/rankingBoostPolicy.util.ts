import { hardMaximumCombinedBoost, hardMaximumOfficialEditorialBoost, hardMaximumTierBoost, tierOrderFromLowest, type AuthorRankingTier } from "../constants/ranking.constant.js";
import type { RankingBoostPolicy } from "../interfaces/rankingSettings.interface.js";

const clampMultiplier = (value: number, maximum: number): number => (Number.isFinite(value) ? Math.min(Math.max(value, 1), maximum) : 1);

export function clampBoostPolicyToHardCaps(policy: RankingBoostPolicy): RankingBoostPolicy {
  const tierBoosts: Record<AuthorRankingTier, number> = { ...hardMaximumTierBoost, none: 1 };
  let previous = 1;
  for (const tier of tierOrderFromLowest) {
    previous = Math.min(Math.max(previous, clampMultiplier(policy.tierBoosts[tier] ?? 1, hardMaximumTierBoost[tier])), hardMaximumTierBoost[tier]);
    tierBoosts[tier] = previous;
  }
  return { version: policy.version, tierBoosts, officialEditorialBoost: clampMultiplier(policy.officialEditorialBoost, hardMaximumOfficialEditorialBoost) };
}

export function calculateCappedAuthorBoost(tier: AuthorRankingTier, isOfficialAccount: boolean, clampedPolicy: RankingBoostPolicy): number {
  const editorial = isOfficialAccount ? clampedPolicy.officialEditorialBoost : 1;
  return Math.min((clampedPolicy.tierBoosts[tier] ?? 1) * editorial, hardMaximumCombinedBoost);
}
