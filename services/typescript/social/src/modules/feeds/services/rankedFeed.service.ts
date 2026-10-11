import { popularFeedCandidateWindowDays } from "../../../constants/social.constant.js";
import type { TrendCategoryTab } from "../../../constants/ranking.constant.js";
import type { AuthorRankingProfile } from "../../../interfaces/authorRanking.interface.js";
import type { FeedRanker, RankedCandidate, RankingCandidate } from "../../../interfaces/feedRanker.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../../utils/cursor.util.js";
import type { EngagementIntegritySignals } from "../../../utils/engagementIntegrity.util.js";
import { classifyTrendCategory } from "../../../utils/trendCategory.util.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { readRankingSettings, resolveViewerCountry } from "../../explore/services/exploreScope.service.js";
import { readTrendingHashtagSlugs } from "../../explore/services/trends.service.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { extractHashtags } from "../../internalSources/services/hashtags.service.js";
import type { PostView } from "../../posts/models/post.model.js";
import type { PostRow } from "../../posts/repositories/post.repository.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import { isPostWithheldFromViewer, resolveCurrentViewerContentPolicy, type ViewerContentPolicy } from "../../posts/services/sensitiveContent.service.js";
import { feedRepository } from "../repositories/feed.repository.js";
import { computeEngagementIntegritySignals } from "./engagementIntegritySignals.service.js";

export interface RankedFeedRequest {
  readonly viewerId: string | undefined;
  readonly personalized: boolean;
  readonly kinds: readonly ("post" | "clip")[];
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly category?: TrendCategoryTab;
  readonly country?: string;
  readonly topicId?: string | undefined;
}

export function matchesTopic(row: PostRow, topicId: string | undefined): boolean {
  if (topicId === undefined) return true;
  const topic = topicId.toLowerCase();
  return row.topics.includes(topic) || extractHashtags(row.text).includes(topic);
}

export function toRankingCandidate(row: PostRow, followedAuthors: ReadonlySet<string>, author?: AuthorRankingProfile, integrity?: EngagementIntegritySignals): RankingCandidate {
  return {
    postId: row.id, authorId: row.authorId, createdAt: row.createdAt, likeCount: row.likeCount, commentCount: row.commentCount,
    repostCount: row.repostCount, shareCount: row.shareCount, viewCount: row.viewCount, followedAuthor: followedAuthors.has(row.authorId),
    saveCount: row.saveCount, hashtags: extractHashtags(row.text), authorTier: author?.tier ?? "none", authorIsOfficial: author?.isOfficial ?? false,
    authorCountry: author?.countryCode ?? null, ...(integrity === undefined ? {} : { integrity }),
  };
}

export function matchesExploreCategory(row: PostRow, category: TrendCategoryTab | undefined, trending: ReadonlySet<string>): boolean {
  if (category === undefined || category === "for_you") return true;
  const hashtags = extractHashtags(row.text);
  if (category === "trending") return hashtags.some((tag) => trending.has(tag));
  return hashtags.some((tag) => classifyTrendCategory(tag) === category);
}

export function attachRankingDisclosure(views: readonly PostView[], rankedById: ReadonlyMap<string, Pick<RankedCandidate, "explanations" | "boostMultiplier">>): PostView[] {
  return views.map((view) => {
    const ranked = rankedById.get(view.id);
    return ranked === undefined ? view : { ...view, ranking: { explanations: ranked.explanations ?? [], boostMultiplier: ranked.boostMultiplier ?? 1 } };
  });
}

export interface RankedFeedCandidates {
  readonly ordered: readonly RankedCandidate[];
  readonly rowById: ReadonlyMap<string, PostRow>;
  readonly policy: ViewerContentPolicy;
}

export interface RankFeedOptions {
  readonly ranker?: FeedRanker;
  readonly withWatchTotals?: boolean;
}

export async function rankFeedCandidates(context: HandlerContext, request: Omit<RankedFeedRequest, "cursor" | "limit">, options: RankFeedOptions = {}): Promise<RankedFeedCandidates> {
  const db = context.database.client;
  const now = context.clock.now();
  const since = new Date(now.getTime() - popularFeedCandidateWindowDays * 86_400_000);
  const rows = await feedRepository.popularCandidates(db, request.kinds, since);
  const authorIds = [...new Set(rows.map((row) => row.authorId))];
  const viewerCountry = await resolveViewerCountry(context, request.viewerId, request.country);
  const [policy, privateAuthors, hiddenAuthors, dismissed, followed, settings, trendingHashtags, authorProfiles, suspended] = await Promise.all([
    resolveCurrentViewerContentPolicy(context, request.viewerId),
    context.directory.findPrivateAccountIds(authorIds),
    request.viewerId === undefined ? new Set<string>() : blockRepository.everyoneBlockedByOrBlocking(db, request.viewerId),
    request.viewerId === undefined || !request.personalized ? new Set<string>() : feedRepository.dismissedPostIds(db, request.viewerId),
    request.viewerId === undefined || !request.personalized ? new Set<string>() : followRepository.followedAccountIds(db, request.viewerId, authorIds),
    readRankingSettings(context),
    readTrendingHashtagSlugs(context, viewerCountry),
    context.authorRanking?.findAuthorRankingProfiles(authorIds) ?? Promise.resolve(new Map<string, AuthorRankingProfile>()),
    context.authorRanking?.findSuspendedAccountIds(authorIds) ?? Promise.resolve(new Set<string>()),
  ]);
  const trendingSet = new Set(trendingHashtags);
  const eligible = rows.filter((row) => !privateAuthors.has(row.authorId) && !hiddenAuthors.has(row.authorId) && !suspended.has(row.authorId) && !dismissed.has(row.id) && row.authorId !== request.viewerId && !isPostWithheldFromViewer(row, policy) && matchesExploreCategory(row, request.category, trendingSet) && matchesTopic(row, request.topicId));
  const mutedTopics = request.viewerId === undefined || !request.personalized ? new Set<string>() : await feedRepository.mutedTopics(db, request.viewerId);
  const sharesMutedTopic = (row: (typeof eligible)[number]) =>
    mutedTopics.size > 0 && (row.topics.some((topic) => mutedTopics.has(topic.toLowerCase())) || extractHashtags(row.text).some((tag) => mutedTopics.has(tag)));
  const [integrity, watchTotals] = await Promise.all([
    context.authorRanking === undefined ? new Map<string, EngagementIntegritySignals>() : computeEngagementIntegritySignals(db, context.authorRanking, eligible, now),
    options.withWatchTotals === true ? feedRepository.watchTotals(db, eligible.map((row) => row.id)) : new Map<string, { readonly videoViews: number; readonly completedViews: number }>(),
  ]);
  const candidates = eligible.map((row) => ({ ...toRankingCandidate(row, followed, authorProfiles.get(row.authorId), integrity.get(row.id)), ...(options.withWatchTotals === true ? toClipSignals(row, watchTotals.get(row.id)) : {}) }));
  const ranker = options.ranker ?? context.ranker;
  const ranked = await ranker.rank(candidates, { viewerId: request.viewerId ?? null, personalized: request.personalized, now, boostPolicy: settings.boostPolicy, trendingHashtags, viewerCountry });
  const demoted = new Set(eligible.filter(sharesMutedTopic).map((row) => row.id));
  const ordered = [...ranked.filter((candidate) => !demoted.has(candidate.postId)), ...ranked.filter((candidate) => demoted.has(candidate.postId))];
  return { ordered, rowById: new Map(eligible.map((row) => [row.id, row])), policy };
}

export function toClipSignals(row: PostRow, totals: { readonly videoViews: number; readonly completedViews: number } | undefined) {
  const durationSeconds = row.media.find((media) => media.type === "video")?.durationSeconds ?? 0;
  return { topics: row.topics, durationMs: durationSeconds * 1000, videoViews: totals?.videoViews ?? 0, completedViews: totals?.completedViews ?? 0 };
}

export async function buildRankedFeedPage(context: HandlerContext, request: RankedFeedRequest): Promise<Page<PostView>> {
  const { ordered, rowById, policy } = await rankFeedCandidates(context, request);
  const offset = decodeOffsetCursor(request.cursor);
  const window = ordered.slice(offset, offset + request.limit);
  const pageRows = window.flatMap((candidate) => rowById.get(candidate.postId) ?? []);
  const nextOffset = offset + request.limit;
  const views = await buildPostViews(context, request.viewerId, pageRows, policy);
  return { data: attachRankingDisclosure(views, new Map(window.map((candidate) => [candidate.postId, candidate]))), nextCursor: nextOffset < ordered.length ? encodeOffsetCursor(nextOffset) : null };
}
