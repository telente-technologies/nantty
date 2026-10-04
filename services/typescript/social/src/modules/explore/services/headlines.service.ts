import { headlineCacheMilliseconds, trendWindowHours, type TrendCategory } from "../../../constants/ranking.constant.js";
import type { IntelligenceHeadline } from "../../../interfaces/intelligenceExplore.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { trendCategoryLabels } from "../../../utils/trendCategory.util.js";
import type { HeadlinesPage, HeadlineView } from "../models/explore.model.js";
import { exploreRepository } from "../repositories/explore.repository.js";
import { describeScope, isRemovedForScope, readRankingSettings } from "./exploreScope.service.js";
import { aggregateTrends, loadEligibleTrendPosts, scoreTrendPost, type EligibleTrendPost } from "./trends.service.js";

const maximumPostsPerHeadline = 10;
const minimumPostsPerHeadline = 3;
const headlineCache = new Map<string, { readonly page: HeadlinesPage; readonly expiresAt: number }>();

export function clearHeadlineCache(): void {
  headlineCache.clear();
}

export function buildTemplateHeadlines(posts: readonly EligibleTrendPost[], now: Date, input: { readonly country: string | null; readonly category: TrendCategory | null; readonly limit: number; readonly isRemoved: (key: string) => boolean }): IntelligenceHeadline[] {
  const trends = aggregateTrends(posts, now, { country: input.country, category: input.category, isRemoved: input.isRemoved });
  return trends
    .filter((trend) => trend.postCount >= minimumPostsPerHeadline)
    .slice(0, input.limit)
    .map((trend) => {
      const members = posts.filter((post) => post.hashtags.includes(trend.hashtag)).sort((left, right) => scoreTrendPost(right, now) - scoreTrendPost(left, now));
      const accounts = trend.authorCount === 1 ? "account" : "accounts";
      return {
        storyKey: trend.hashtag,
        title: `People are posting about #${trend.hashtag}`,
        summary: `${trend.postCount} public posts from ${trend.authorCount} ${accounts} in the last ${trendWindowHours} hours.`,
        category: trend.category,
        postIds: members.slice(0, maximumPostsPerHeadline).map((post) => post.id),
        postCount: trend.postCount,
        authorCount: trend.authorCount,
        topHashtags: [trend.hashtag],
        generatedBy: "template_v1" as const,
      };
    });
}

async function toHeadlineView(context: HandlerContext, headline: IntelligenceHeadline): Promise<HeadlineView> {
  return {
    id: headline.storyKey,
    title: headline.title,
    summary: headline.summary,
    category: headline.category,
    categoryLabel: trendCategoryLabels[headline.category] ?? "Other",
    postIds: headline.postIds.slice(0, maximumPostsPerHeadline),
    postCount: headline.postCount,
    authorCount: headline.authorCount,
    hashtags: headline.topHashtags,
    coverImageUrl: await exploreRepository.firstImageForPosts(context.database.client, headline.postIds.slice(0, 3)),
    sourceLabel: "Summarised from posts",
    generatedBy: headline.generatedBy,
  };
}

export async function computeHeadlines(context: HandlerContext, input: { readonly country: string | null; readonly category: TrendCategory | null; readonly limit: number }): Promise<HeadlinesPage> {
  const now = context.clock.now();
  const cacheKey = `${input.country ?? "*"}|${input.category ?? "*"}|${input.limit}`;
  const cached = headlineCache.get(cacheKey);
  if (cached !== undefined && cached.expiresAt > now.getTime()) return cached.page;
  const [allPosts, settings] = await Promise.all([loadEligibleTrendPosts(context), readRankingSettings(context)]);
  const posts = input.country === null ? allPosts : allPosts.filter((post) => post.authorCountry === input.country);
  const isRemoved = (key: string) => isRemovedForScope(settings.trendRemovals, ["headline", "hashtag", "topic"], key, input.country);
  const excludedStoryKeys = settings.trendRemovals.map((removal) => removal.key);
  const generated = await context.intelligenceExplore?.buildHeadlines({
    country: input.country,
    category: input.category,
    limit: input.limit,
    excludedStoryKeys,
    posts: posts.map((post) => ({ postId: post.id, authorId: post.authorId, text: post.text, hashtags: post.hashtags, createdAt: post.createdAt.toISOString(), likeCount: post.likeCount, commentCount: post.commentCount, repostCount: post.repostCount, shareCount: post.shareCount, viewCount: post.viewCount })),
  });
  const headlines = (generated ?? buildTemplateHeadlines(posts, now, { ...input, isRemoved })).filter((headline) => !isRemoved(headline.storyKey));
  const page: HeadlinesPage = { scope: describeScope(input.country), items: await Promise.all(headlines.slice(0, input.limit).map((headline) => toHeadlineView(context, headline))), generatedAt: now.toISOString() };
  headlineCache.set(cacheKey, { page, expiresAt: now.getTime() + headlineCacheMilliseconds });
  return page;
}
