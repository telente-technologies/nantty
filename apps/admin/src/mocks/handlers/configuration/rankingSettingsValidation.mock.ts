import { hardMaximumOfficialEditorialBoostBps, hardMaximumTierBoostBps, neutralBoostBps, rankingTierOrderFromLowest } from "@/constants/rankingCaps.constant";
import { failValidation } from "@/mocks/mockResponses.mock";
import type { FeedRankingPolicy, RankingTier, TrendRemoval, TrendRemovalKind, TrendRemovalReason } from "@/types/ranking.type";

import { readArrayAtPath, readEnumFromObject, readIntegerBetween, readObjectAtPath, readTextValue } from "./configurationFieldReaders.mock";

const allowedPolicyKeys = new Set(["tierBoostBps", "officialEditorialBoostBps"]);
const removalKinds: readonly TrendRemovalKind[] = ["hashtag", "topic", "headline"];
const removalReasons: readonly TrendRemovalReason[] = ["spam", "manipulation", "hate", "harassment", "misinformation", "violence", "sexual", "illegal", "privacy", "other"];

export function validateFeedRankingPolicy(rawContent: unknown): FeedRankingPolicy {
  const content = readObjectAtPath(rawContent, "content");
  for (const key of Object.keys(content)) if (!allowedPolicyKeys.has(key)) failValidation(`content.${key}`, "Only capped checkmark and Official boosts can be configured. There is no push or pin setting.");
  const tiers = readObjectAtPath(content["tierBoostBps"], "content.tierBoostBps");
  if (Object.keys(tiers).length !== rankingTierOrderFromLowest.length) failValidation("content.tierBoostBps", "List exactly the five checkmark tiers.");
  const tierBoostBps = {} as Record<RankingTier, number>;
  let previous = neutralBoostBps;
  for (const tier of rankingTierOrderFromLowest) {
    const value = readIntegerBetween(tiers, tier, "content.tierBoostBps", neutralBoostBps, hardMaximumTierBoostBps[tier]);
    if (value < previous) failValidation(`content.tierBoostBps.${tier}`, "Keep the order Blue Essential ≤ Blue Verified ≤ Premium ≤ Gold Business ≤ Black/Official.");
    previous = value;
    tierBoostBps[tier] = value;
  }
  return { tierBoostBps, officialEditorialBoostBps: readIntegerBetween(content, "officialEditorialBoostBps", "content", neutralBoostBps, hardMaximumOfficialEditorialBoostBps) };
}

export function validateTrendRemovals(rawValue: unknown): TrendRemoval[] {
  const value = readObjectAtPath(rawValue, "value");
  const seen = new Set<string>();
  return readArrayAtPath(value["removals"], "value.removals", 500).map((entry, index) => {
    const path = `value.removals.${index}`;
    const item = readObjectAtPath(entry, path);
    const removal: TrendRemoval = {
      kind: readEnumFromObject(item, "kind", path, removalKinds),
      key: readTextValue(item, "key", path, 64, 1),
      country: readTextValue(item, "country", path, 2, 0).toUpperCase(),
      reason: readEnumFromObject(item, "reason", path, removalReasons),
      note: readTextValue(item, "note", path, 500, 0),
      removedAt: readTextValue(item, "removedAt", path, 40, 10),
    };
    if (!/^[a-z0-9_-]{1,64}$/.test(removal.key)) failValidation(`${path}.key`, "Use the hashtag or story key in lowercase, without #.");
    if (removal.country !== "" && !/^[A-Z]{2}$/.test(removal.country)) failValidation(`${path}.country`, "Use a two-letter country code or leave it empty for everywhere.");
    const identity = `${removal.kind}|${removal.key}|${removal.country}`;
    if (seen.has(identity)) failValidation(path, "This trend is already removed for that scope.");
    seen.add(identity);
    return removal;
  });
}
