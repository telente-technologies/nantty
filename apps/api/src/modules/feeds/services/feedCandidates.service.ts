import type { IdentifierHasher } from "../../../interfaces/intelligence.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { ClipCandidate, FeedCandidate, ViewerContext } from "../../intelligence/models/intelligenceRanking.model.js";
import { sanitizeTopicSlugs } from "../../intelligence/services/intelligenceEnvelope.service.js";
import type { PostRecord } from "../../posts/models/posts.model.js";

const MAXIMUM_ID_LIST_LENGTH = 5_000;
const MAXIMUM_FRIEND_ENGAGEMENTS = 50;
const HASHTAG_PATTERN = /#([\p{L}\p{N}_-]{1,64})/gu;

export interface ViewerRelationships {
  readonly followedUserIds: readonly string[];
  readonly followedStoreIds: readonly string[];
  readonly blockedUserIds: readonly string[];
}

export interface ViewerFeedState {
  readonly hiddenPostIds: ReadonlySet<string>;
  readonly seenPostIds: readonly string[];
  readonly chosenTopics: readonly string[];
}

export function extractHashtags(text: string): string[] {
  return sanitizeTopicSlugs([...text.matchAll(HASHTAG_PATTERN)].map((match) => match[1] ?? ""));
}

export function buildViewerContext(
  viewerId: string,
  country: string | null,
  relationships: ViewerRelationships,
  state: ViewerFeedState,
  hasher: IdentifierHasher,
): ViewerContext {
  return {
    userId: hasher.hashUserId(viewerId),
    country: country !== null && /^[A-Z]{2}$/.test(country) ? country : null,
    chosenTopics: sanitizeTopicSlugs(state.chosenTopics),
    followedAccountIds: [...relationships.followedUserIds.map((id) => hasher.hashUserId(id)), ...relationships.followedStoreIds].slice(0, MAXIMUM_ID_LIST_LENGTH),
    blockedAccountIds: relationships.blockedUserIds.map((id) => hasher.hashUserId(id)).slice(0, MAXIMUM_ID_LIST_LENGTH),
    hiddenItemIds: [...state.hiddenPostIds].slice(0, MAXIMUM_ID_LIST_LENGTH),
    seenItemIds: state.seenPostIds.slice(0, MAXIMUM_ID_LIST_LENGTH),
  };
}

function describeMediaKind(post: PostRecord): FeedCandidate["mediaKind"] {
  if (post.media.length === 0) return "text";
  if (post.media.length > 1) return "carousel";
  return post.media[0]?.type === "video" ? "video" : "image";
}

export function buildFeedCandidates(
  posts: readonly PostRecord[],
  friendLikers: ReadonlyMap<string, readonly string[]>,
  authors: ReadonlyMap<string, UserSummary>,
  hasher: IdentifierHasher,
): FeedCandidate[] {
  return posts.map((post) => ({
    itemId: post.id,
    authorId: hasher.hashUserId(post.authorId),
    storeId: post.storeId,
    contentKind: post.productIds.length > 0 ? "product" : "personal",
    mediaKind: describeMediaKind(post),
    mediaCount: Math.min(10, post.media.length),
    createdAt: post.createdAt.toISOString(),
    topics: sanitizeTopicSlugs(post.topics),
    hashtags: extractHashtags(post.text),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount + post.repostCount,
    viewCount: post.viewCount,
    authorFollowerCount: 0,
    authorIsVerified: authors.get(post.authorId)?.verification !== undefined,
    isSensitive: false,
    isReported: false,
    friendEngagements: (friendLikers.get(post.id) ?? []).slice(0, MAXIMUM_FRIEND_ENGAGEMENTS).map((friendId) => ({ friendId: hasher.hashUserId(friendId), action: "liked" as const })),
  }));
}

export function buildClipCandidates(posts: readonly PostRecord[], hasher: IdentifierHasher): ClipCandidate[] {
  return posts.map((post) => ({
    itemId: post.id,
    creatorId: hasher.hashUserId(post.authorId),
    createdAt: post.createdAt.toISOString(),
    durationMs: 0,
    topics: sanitizeTopicSlugs(post.topics),
    hashtags: extractHashtags(post.text),
    viewCount: post.viewCount,
    completionCount: 0,
    rewatchCount: 0,
    creatorFollowerCount: 0,
    creatorIsNew: false,
    isSensitive: false,
  }));
}

export function orderPostsByRanking(posts: readonly PostRecord[], rankedIds: readonly string[]): PostRecord[] {
  const byId = new Map(posts.map((post) => [post.id, post]));
  const ranked = rankedIds.map((id) => byId.get(id)).filter((post): post is PostRecord => post !== undefined);
  const rankedSet = new Set(rankedIds);
  const remainder = posts.filter((post) => !rankedSet.has(post.id)).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
  return [...ranked, ...remainder];
}
