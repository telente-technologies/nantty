import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { TrendingItem, TrendingKind, TrendingResponse } from "../../intelligence/models/intelligenceRanking.model.js";
import { buildFallbackMetadata } from "../../intelligence/services/intelligenceFallbacks.service.js";
import { sanitizeTopicSlugs } from "../../intelligence/services/intelligenceEnvelope.service.js";
import type { PostDto } from "../../posts/dtos/posts.dto.js";
import type { PostRecord } from "../../posts/models/posts.model.js";
import { extractHashtags } from "./feedCandidates.service.js";
import type { FeedsService } from "./feeds.service.js";

export type TrendingPostKind = Extract<TrendingKind, "hashtag" | "topic" | "post" | "clip">;

const TRENDING_WINDOW_MS = 24 * 3_600_000;
const FALLBACK_CANDIDATE_LIMIT = 500;
const MINIMUM_DISTINCT_ACTORS = 2;
const TAG_PATTERN = /^[a-z0-9_-]{1,64}$/;

export interface TrendingTagDto {
  readonly tag: string;
  readonly score: number;
  readonly distinctActors: number;
}

export interface TrendingResultDto {
  readonly kind: TrendingPostKind;
  readonly source: "intelligence" | "fallback";
  readonly tags: readonly TrendingTagDto[];
  readonly posts: readonly PostDto[];
}

function countTags(posts: readonly PostRecord[], readTags: (post: PostRecord) => readonly string[]): TrendingItem[] {
  const authorsByTag = new Map<string, Set<string>>();
  const engagementByTag = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(readTags(post))) {
      authorsByTag.set(tag, (authorsByTag.get(tag) ?? new Set()).add(post.authorId));
      engagementByTag.set(tag, (engagementByTag.get(tag) ?? 0) + 1 + post.likeCount + post.commentCount + post.shareCount);
    }
  }
  return [...authorsByTag.entries()]
    .filter(([, authors]) => authors.size >= MINIMUM_DISTINCT_ACTORS)
    .map(([tag, authors]) => ({ itemId: tag, score: (engagementByTag.get(tag) ?? 0) * Math.log1p(authors.size), acceleration: 1, distinctActors: authors.size }));
}

export class TrendingService {
  public constructor(private readonly feedsService: FeedsService) {}

  public async readTrending(viewerId: string, kind: TrendingPostKind, country: string | null, limit: number, displayCurrency: CurrencyCode): Promise<TrendingResultDto> {
    const { discovery, clock } = this.feedsService.dependencies;
    const now = clock.now();
    const outcome = await discovery.ranking.readTrending(
      { kind, country, limit, minimumDistinctActors: 5, now: now.toISOString() },
      () => this.computeTrendingWithoutIntelligence(kind, country, limit, now),
    );
    if (kind === "hashtag" || kind === "topic") {
      const tags = outcome.response.items
        .filter((item) => typeof item.itemId === "string" && TAG_PATTERN.test(item.itemId))
        .slice(0, limit)
        .map((item) => ({ tag: item.itemId, score: item.score, distinctActors: item.distinctActors }));
      return { kind, source: outcome.source, tags, posts: [] };
    }
    const { postsService } = this.feedsService.dependencies;
    const ids = outcome.response.items.map((item) => item.itemId).slice(0, limit);
    const blocked = new Set(await this.feedsService.dependencies.socialGraph.listUserIdsBlockedEitherWay(viewerId));
    const byId = new Map((await postsService.dependencies.posts.findManyByIds(ids)).map((post) => [post.id, post]));
    const visible = ids
      .map((id) => byId.get(id))
      .filter((post): post is PostRecord => post !== undefined && post.kind === kind && post.deletedAt === null && !blocked.has(post.authorId) && (post.expiresAt === null || post.expiresAt > now));
    return { kind, source: outcome.source, tags: [], posts: await postsService.presenter.presentPosts(visible, viewerId, displayCurrency) };
  }

  private async computeTrendingWithoutIntelligence(kind: TrendingPostKind, country: string | null, limit: number, now: Date): Promise<TrendingResponse> {
    const posts = await this.feedsService.dependencies.postsService.dependencies.posts.listRecentCandidates(
      { kinds: kind === "clip" ? ["clip"] : kind === "post" ? ["post"] : ["post", "clip"], createdAfter: new Date(now.getTime() - TRENDING_WINDOW_MS) },
      now,
      FALLBACK_CANDIDATE_LIMIT,
    );
    const items = kind === "hashtag"
      ? countTags(posts, (post) => extractHashtags(post.text))
      : kind === "topic"
        ? countTags(posts, (post) => sanitizeTopicSlugs(post.topics))
        : posts.map((post) => ({ itemId: post.id, score: post.likeCount + 2 * post.commentCount + 3 * post.shareCount + 0.05 * post.viewCount, acceleration: 1, distinctActors: post.likeCount }));
    const ranked = items.sort((left, right) => right.score - left.score || left.itemId.localeCompare(right.itemId)).slice(0, limit);
    return { kind, scope: country ?? "global", items: ranked, metadata: buildFallbackMetadata(`trending_${kind}`, "trending", now.toISOString()) };
  }
}
