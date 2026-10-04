import { burstWindowMinutes, integrityCandidateLimit, integrityLikeSampleLimit, integrityWindowHours, minimumEngagersForBurstCheck, newAccountAgeDays } from "../../../constants/ranking.constant.js";
import type { AuthorRankingDirectory } from "../../../interfaces/authorRanking.interface.js";
import type { Db } from "../../../types/database.type.js";
import { cleanIntegritySignals, type EngagementIntegritySignals } from "../../../utils/engagementIntegrity.util.js";
import { isSpammyHashtag } from "../../../utils/trendCategory.util.js";
import { extractHashtags } from "../../internalSources/services/hashtags.service.js";

export interface IntegrityCandidateRow {
  readonly id: string;
  readonly authorId: string;
  readonly text: string;
  readonly likeCount: number;
}

export interface EngagementLike {
  readonly postId: string;
  readonly userId: string;
  readonly createdAt: Date;
}

const podLookbackDays = 7;
const minimumEngagersForPodCheck = 10;

export function calculateBurstRatio(likeTimes: readonly number[]): number {
  if (likeTimes.length < minimumEngagersForBurstCheck) return 0;
  const sorted = [...likeTimes].sort((left, right) => left - right);
  const windowMilliseconds = burstWindowMinutes * 60_000;
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end += 1) {
    while ((sorted[end] ?? 0) - (sorted[start] ?? 0) > windowMilliseconds) start += 1;
    best = Math.max(best, end - start + 1);
  }
  return best / sorted.length;
}

export function buildIntegritySignalsForPost(input: {
  readonly authorId: string;
  readonly text: string;
  readonly likes: readonly EngagementLike[];
  readonly accountCreatedAt: ReadonlyMap<string, Date>;
  readonly suspendedAccountIds: ReadonlySet<string>;
  readonly accountsAuthorLiked: ReadonlySet<string>;
  readonly now: Date;
}): EngagementIntegritySignals {
  const engagers = input.likes.filter((like) => like.userId !== input.authorId);
  const engagerIds = [...new Set(engagers.map((like) => like.userId))];
  const spamHashtagCount = extractHashtags(input.text).filter(isSpammyHashtag).length;
  if (engagerIds.length === 0) return { ...cleanIntegritySignals, spamHashtagCount };
  const newAccountCutoff = input.now.getTime() - newAccountAgeDays * 86_400_000;
  const share = (count: number) => count / engagerIds.length;
  return {
    ...cleanIntegritySignals,
    engagerCount: engagerIds.length,
    newAccountEngagerShare: share(engagerIds.filter((id) => (input.accountCreatedAt.get(id)?.getTime() ?? 0) > newAccountCutoff).length),
    suspendedEngagerShare: share(engagerIds.filter((id) => input.suspendedAccountIds.has(id)).length),
    reciprocalPodShare: engagerIds.length >= minimumEngagersForPodCheck ? share(engagerIds.filter((id) => input.accountsAuthorLiked.has(id)).length) : 0,
    burstRatio: calculateBurstRatio(engagers.map((like) => like.createdAt.getTime())),
    spamHashtagCount,
  };
}

export async function computeEngagementIntegritySignals(db: Db, directory: AuthorRankingDirectory, rows: readonly IntegrityCandidateRow[], now: Date): Promise<Map<string, EngagementIntegritySignals>> {
  const result = new Map<string, EngagementIntegritySignals>();
  const checked = [...rows].sort((left, right) => right.likeCount - left.likeCount).slice(0, integrityCandidateLimit).filter((row) => row.likeCount > 0);
  for (const row of rows) result.set(row.id, { ...cleanIntegritySignals, spamHashtagCount: extractHashtags(row.text).filter(isSpammyHashtag).length });
  if (checked.length === 0) return result;
  const likes = await db.postLike.findMany({
    where: { postId: { in: checked.map((row) => row.id) }, createdAt: { gte: new Date(now.getTime() - integrityWindowHours * 3_600_000) } },
    select: { postId: true, userId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: integrityLikeSampleLimit,
  });
  const authorIds = [...new Set(checked.map((row) => row.authorId))];
  const engagerIds = [...new Set(likes.map((like) => like.userId))];
  const [createdAt, suspended, authorLikes] = await Promise.all([
    directory.findAccountCreatedDates(engagerIds),
    directory.findSuspendedAccountIds(engagerIds),
    db.postLike.findMany({ where: { userId: { in: authorIds }, createdAt: { gte: new Date(now.getTime() - podLookbackDays * 86_400_000) } }, select: { userId: true, post: { select: { authorId: true } } }, take: integrityLikeSampleLimit }),
  ]);
  const likedAuthorsByAuthor = new Map<string, Set<string>>();
  for (const like of authorLikes) {
    const set = likedAuthorsByAuthor.get(like.userId) ?? new Set<string>();
    set.add(like.post.authorId);
    likedAuthorsByAuthor.set(like.userId, set);
  }
  const likesByPost = new Map<string, EngagementLike[]>();
  for (const like of likes) likesByPost.set(like.postId, [...(likesByPost.get(like.postId) ?? []), like]);
  for (const row of checked) {
    result.set(row.id, buildIntegritySignalsForPost({ authorId: row.authorId, text: row.text, likes: likesByPost.get(row.id) ?? [], accountCreatedAt: createdAt, suspendedAccountIds: suspended, accountsAuthorLiked: likedAuthorsByAuthor.get(row.authorId) ?? new Set(), now }));
  }
  return result;
}
