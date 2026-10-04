import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { FollowSuggestion } from "../models/explore.model.js";
import { exploreRepository } from "../repositories/explore.repository.js";

type ReasonCode = FollowSuggestion["reason"]["code"];

const reasonLabels: Readonly<Record<ReasonCode, string>> = {
  mutuals: "Followed by people you follow",
  interests: "Similar to posts you liked",
  popular_in_region: "Popular in your region",
  popular: "Popular on Zudomart",
};
const reasonWeights: Readonly<Record<ReasonCode, number>> = { mutuals: 3, interests: 2, popular_in_region: 1.5, popular: 1 };

export async function suggestAccountsToFollow(context: HandlerContext, input: { readonly viewerId: string | undefined; readonly country: string | null; readonly limit: number }): Promise<FollowSuggestion[]> {
  const db = context.database.client;
  const now = context.clock.now();
  const scores = new Map<string, { score: number; reason: ReasonCode }>();
  const add = (accountId: string, reason: ReasonCode, amount = 1) => {
    const current = scores.get(accountId);
    const score = (current?.score ?? 0) + amount * reasonWeights[reason];
    const strongest = current === undefined || reasonWeights[reason] > reasonWeights[current.reason] ? reason : current.reason;
    scores.set(accountId, { score, reason: strongest });
  };
  const followed = input.viewerId === undefined ? [] : await followRepository.allFollowedAccountIds(db, input.viewerId, 2000);
  const excluded = new Set<string>(followed);
  if (input.viewerId !== undefined) {
    excluded.add(input.viewerId);
    for (const id of await blockRepository.everyoneBlockedByOrBlocking(db, input.viewerId)) excluded.add(id);
    for (const row of await exploreRepository.followeesOfAccounts(db, followed.slice(0, 200), 4000)) add(row.followeeId, "mutuals");
    for (const authorId of await exploreRepository.recentlyLikedAuthors(db, input.viewerId, new Date(now.getTime() - 30 * 86_400_000), 300)) add(authorId, "interests", 0.5);
  }
  const popular = await exploreRepository.recentFollowTargets(db, new Date(now.getTime() - 7 * 86_400_000), 5000);
  const popularCounts = new Map<string, number>();
  for (const row of popular) popularCounts.set(row.followeeId, (popularCounts.get(row.followeeId) ?? 0) + 1);
  const popularIds = [...popularCounts.keys()];
  const profiles = context.authorRanking === undefined ? new Map() : await context.authorRanking.findAuthorRankingProfiles([...new Set([...popularIds, ...scores.keys()])]);
  for (const [accountId, count] of popularCounts) {
    const sameRegion = input.country !== null && profiles.get(accountId)?.countryCode === input.country;
    add(accountId, sameRegion ? "popular_in_region" : "popular", Math.log1p(count));
  }
  const candidateIds = [...scores.keys()].filter((id) => !excluded.has(id));
  const [privateAccounts, suspended] = await Promise.all([
    context.directory.findPrivateAccountIds(candidateIds),
    context.authorRanking?.findSuspendedAccountIds(candidateIds) ?? Promise.resolve(new Set<string>()),
  ]);
  const ordered = candidateIds
    .filter((id) => !privateAccounts.has(id) && !suspended.has(id))
    .sort((left, right) => (scores.get(right)?.score ?? 0) - (scores.get(left)?.score ?? 0) || left.localeCompare(right))
    .slice(0, input.limit * 2);
  const summaries = await context.directory.findUserSummaries(ordered);
  const missingProfiles = ordered.filter((id) => !profiles.has(id));
  const extraProfiles = missingProfiles.length === 0 || context.authorRanking === undefined ? new Map() : await context.authorRanking.findAuthorRankingProfiles(missingProfiles);
  return ordered.flatMap((accountId) => {
    const user = summaries.get(accountId);
    const entry = scores.get(accountId);
    if (user === undefined || entry === undefined) return [];
    const profile = profiles.get(accountId) ?? extraProfiles.get(accountId);
    return [{ user, reason: { code: entry.reason, label: reasonLabels[entry.reason] }, isOfficial: profile?.isOfficial ?? false, checkmarkTier: profile?.tier ?? "none" }];
  }).slice(0, input.limit);
}
