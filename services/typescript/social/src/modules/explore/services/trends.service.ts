import { trendCandidatePostLimit, trendMinimumDistinctAuthors, trendWindowHours, type TrendCategory } from "../../../constants/ranking.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { assessEngagementIntegrity, cleanIntegritySignals } from "../../../utils/engagementIntegrity.util.js";
import { classifyTrendCategory, isSpammyHashtag, trendCategoryLabels } from "../../../utils/trendCategory.util.js";
import { computeEngagementIntegritySignals } from "../../feeds/services/engagementIntegritySignals.service.js";
import { extractHashtags } from "../../internalSources/services/hashtags.service.js";
import type { TrendsPage, TrendView } from "../models/explore.model.js";
import { exploreRepository } from "../repositories/explore.repository.js";
import { describeScope, isRemovedForScope, readRankingSettings } from "./exploreScope.service.js";

export interface EligibleTrendPost {
  readonly id: string;
  readonly authorId: string;
  readonly text: string;
  readonly createdAt: Date;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly saveCount: number;
  readonly hashtags: readonly string[];
  readonly trustedShare: number;
  readonly authorCountry: string | null;
}

interface HashtagAggregate {
  readonly hashtag: string;
  score: number;
  postCount: number;
  readonly authors: Map<string, number>;
}

const maximumPostsPerAuthorPerTrend = 2;
const cacheMilliseconds = 60_000;
const eligibleCache = new Map<string, { readonly posts: readonly EligibleTrendPost[]; readonly expiresAt: number }>();

export function clearExploreCaches(): void {
  eligibleCache.clear();
}

export async function loadEligibleTrendPosts(context: HandlerContext): Promise<readonly EligibleTrendPost[]> {
  const now = context.clock.now();
  const cached = eligibleCache.get("all");
  if (cached !== undefined && cached.expiresAt > now.getTime()) return cached.posts;
  const db = context.database.client;
  const rows = await exploreRepository.recentPublicPosts(db, new Date(now.getTime() - trendWindowHours * 3_600_000), trendCandidatePostLimit);
  const authorIds = [...new Set(rows.map((row) => row.authorId))];
  const [privateAuthors, suspended, profiles] = await Promise.all([
    context.directory.findPrivateAccountIds(authorIds),
    context.authorRanking?.findSuspendedAccountIds(authorIds) ?? Promise.resolve(new Set<string>()),
    context.authorRanking?.findAuthorRankingProfiles(authorIds) ?? Promise.resolve(new Map()),
  ]);
  const visible = rows.filter((row) => !privateAuthors.has(row.authorId) && !suspended.has(row.authorId));
  const integrity = context.authorRanking === undefined ? new Map() : await computeEngagementIntegritySignals(db, context.authorRanking, visible, now);
  const posts = visible.flatMap((row) => {
    const assessment = assessEngagementIntegrity(integrity.get(row.id) ?? cleanIntegritySignals);
    if (assessment.manipulated) return [];
    return [{ ...row, hashtags: extractHashtags(row.text), trustedShare: assessment.trustedEngagementShare, authorCountry: profiles.get(row.authorId)?.countryCode ?? null }];
  });
  eligibleCache.set("all", { posts, expiresAt: now.getTime() + cacheMilliseconds });
  return posts;
}

export function scoreTrendPost(post: EligibleTrendPost, now: Date): number {
  const interactions = (post.likeCount + 2 * post.saveCount + 3 * post.commentCount + 4 * (post.repostCount + post.shareCount)) * post.trustedShare;
  const ageHours = Math.max((now.getTime() - post.createdAt.getTime()) / 3_600_000, 0.5);
  return (1 + Math.log1p(interactions)) / Math.sqrt(ageHours);
}

export function aggregateTrends(posts: readonly EligibleTrendPost[], now: Date, filter: { readonly country: string | null; readonly category: TrendCategory | null; readonly isRemoved: (hashtag: string) => boolean }): TrendView[] {
  const aggregates = new Map<string, HashtagAggregate>();
  for (const post of posts) {
    if (filter.country !== null && post.authorCountry !== filter.country) continue;
    const score = scoreTrendPost(post, now);
    for (const hashtag of post.hashtags) {
      if (isSpammyHashtag(hashtag) || !/^[\p{L}\p{N}_]{2,50}$/u.test(hashtag)) continue;
      const aggregate = aggregates.get(hashtag) ?? { hashtag, score: 0, postCount: 0, authors: new Map<string, number>() };
      const authorPosts = aggregate.authors.get(post.authorId) ?? 0;
      aggregate.authors.set(post.authorId, authorPosts + 1);
      if (authorPosts < maximumPostsPerAuthorPerTrend) aggregate.score += score;
      aggregate.postCount += 1;
      aggregates.set(hashtag, aggregate);
    }
  }
  const scope = describeScope(filter.country);
  return [...aggregates.values()]
    .filter((aggregate) => aggregate.authors.size >= trendMinimumDistinctAuthors && !filter.isRemoved(aggregate.hashtag))
    .map((aggregate) => ({ aggregate, category: classifyTrendCategory(aggregate.hashtag) }))
    .filter(({ category }) => filter.category === null || category === filter.category)
    .map(({ aggregate, category }) => ({ aggregate, category, score: aggregate.score * Math.log1p(aggregate.authors.size) }))
    .sort((left, right) => right.score - left.score || left.aggregate.hashtag.localeCompare(right.aggregate.hashtag))
    .map(({ aggregate, category }, index) => ({
      hashtag: aggregate.hashtag,
      label: `#${aggregate.hashtag}`,
      category,
      categoryLabel: trendCategoryLabels[category] ?? "Other",
      postCount: aggregate.postCount,
      authorCount: aggregate.authors.size,
      rank: index + 1,
      scope,
      context: category === "other" ? `Trending ${scope}` : `${trendCategoryLabels[category]} · Trending`,
    }));
}

export async function computeTrends(context: HandlerContext, input: { readonly country: string | null; readonly category: TrendCategory | null; readonly limit: number }): Promise<TrendsPage> {
  const now = context.clock.now();
  const [posts, settings] = await Promise.all([loadEligibleTrendPosts(context), readRankingSettings(context)]);
  const isRemoved = (hashtag: string) => isRemovedForScope(settings.trendRemovals, ["hashtag", "topic"], hashtag, input.country);
  const deterministic = aggregateTrends(posts, now, { ...input, isRemoved });
  const removedKeys = settings.trendRemovals.filter((removal) => removal.kind !== "headline").map((removal) => removal.key);
  const realtime = await context.intelligenceExplore?.readTrendingHashtags({ country: input.country, category: input.category, limit: input.limit * 2, excludedIds: removedKeys });
  if (realtime === null || realtime === undefined || realtime.length === 0) {
    return { scope: describeScope(input.country), category: input.category, items: deterministic.slice(0, input.limit), source: "deterministic", generatedAt: now.toISOString() };
  }
  const byHashtag = new Map(deterministic.map((trend) => [trend.hashtag, trend]));
  const merged = realtime.flatMap((item) => (isRemoved(item.itemId) ? [] : [byHashtag.get(item.itemId)].filter((trend): trend is TrendView => trend !== undefined)));
  const seen = new Set(merged.map((trend) => trend.hashtag));
  const combined = [...merged, ...deterministic.filter((trend) => !seen.has(trend.hashtag))].slice(0, input.limit).map((trend, index) => ({ ...trend, rank: index + 1 }));
  return { scope: describeScope(input.country), category: input.category, items: combined, source: "intelligence", generatedAt: now.toISOString() };
}

export async function readTrendingHashtagSlugs(context: HandlerContext, country: string | null): Promise<string[]> {
  const page = await computeTrends(context, { country, category: null, limit: 20 }).catch(() => undefined);
  return page?.items.map((trend) => trend.hashtag) ?? [];
}
