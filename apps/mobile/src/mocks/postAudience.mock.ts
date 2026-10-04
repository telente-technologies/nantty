import { ApiError } from "@/errors/api.error";
import type { ContentPreferences, Page, Post, ReplyPolicy, SensitiveLabel } from "@/types";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { mockPostsState, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";

const QUOTES_PAGE_SIZE = 10;
const LABELS_WITHHELD_FROM_UNKNOWN_AGES: readonly SensitiveLabel[] = ["nudity", "dangerous_acts"];
const contentPreferences = { showSensitiveWithoutWarning: false };

export const isWithheldFromViewerWithoutAge = (post: Post) => (post.sensitive?.labels ?? []).some((label) => LABELS_WITHHELD_FROM_UNKNOWN_AGES.includes(label));

const updatePost = (postId: string, change: (post: Post) => Post): Post => {
  const post = mockPostsState.get(postId);
  if (!post) throw new ApiError(404, "This post was removed");
  const updated = change(post);
  mockPostsState.set(postId, updated);
  return updated;
};

const seedQuote = (id: string, originalId: string, authorPostId: string, hoursAgo: number, text: string, likes: number) => {
  const original = mockPostsState.get(originalId);
  const author = mockPostsState.get(authorPostId)?.author;
  if (!original || !author || mockPostsState.has(id)) return;
  mockPostsState.set(id, {
    id, kind: "post", author, createdAt: isoDateHoursAgo(hoursAgo), text, media: [], likes, comments: 2, reposts: 0, views: likes * 14,
    liked: false, bookmarked: false, saveCount: 0, isFollowingAuthor: false, friendsLiked: null, products: [], sponsored: null,
    resharedFrom: original, isQuote: true, quotes: 0, replyPolicy: "everyone", viewerCanReply: true, replyRestriction: null, sensitive: null,
  });
  updatePost(originalId, (post) => ({ ...post, quotes: (post.quotes ?? 0) + 1 }));
};

const seedAudienceExamples = () => {
  const restrictions: Readonly<Record<string, { policy: ReplyPolicy; message: string }>> = {
    post_2: { policy: "mentioned", message: "Only people mentioned in this post can reply." },
    post_10: { policy: "off", message: "The author turned off replies for this post." },
    post_12: { policy: "followers", message: "Only the author's followers can reply." },
  };
  for (const [postId, restriction] of Object.entries(restrictions)) {
    if (mockPostsState.has(postId)) updatePost(postId, (post) => ({ ...post, replyPolicy: restriction.policy, viewerCanReply: false, replyRestriction: { reason: restriction.policy === "off" ? "REPLIES_OFF" : restriction.policy === "followers" ? "FOLLOWERS_ONLY" : "MENTIONED_ONLY", message: restriction.message } }));
  }
  if (mockPostsState.has("post_14")) updatePost("post_14", (post) => ({ ...post, sensitive: { labels: ["dangerous_acts"], requiresInterstitial: true } }));
  seedQuote("quote_post_3_a", "post_3", "post_2", 7, "Surulere is underrated for jollof. Try the spot by the stadium next, the plantain alone is worth it.", 86);
  seedQuote("quote_post_3_b", "post_3", "post_8", 5, "Part 7 and still no Ibadan entry? We need to talk.", 41);
};

seedAudienceExamples();

const applySensitivePreferenceToEveryPost = (showWithoutWarning: boolean) => {
  for (const post of mockPostsState.values()) {
    if (post.sensitive && post.sensitive.labels.length > 0) mockPostsState.set(post.id, { ...post, sensitive: { ...post.sensitive, requiresInterstitial: !showWithoutWarning && post.author.id !== getSignedInMockUser().id } });
  }
};

const describePreferences = (isGuest: boolean | undefined): ContentPreferences => ({
  showSensitiveWithoutWarning: !isGuest && contentPreferences.showSensitiveWithoutWarning,
  canChangeSensitiveContentSetting: !isGuest,
  ageBracket: isGuest ? "unknown" : "adult",
});

export const postAudienceMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/quotes", ({ params, query, isGuest }) => {
    const quotes = [...mockPostsState.values()]
      .filter((post) => post.isQuote && post.resharedFrom?.id === params.postId && isAuthorContentVisibleToSignedInViewer(post.author.id) && !(isGuest && isWithheldFromViewerWithoutAge(post)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = Number(query.get("cursor") ?? 0);
    const page: Page<Post> = { data: quotes.slice(start, start + QUOTES_PAGE_SIZE).map(withCurrentProductPrices), nextCursor: start + QUOTES_PAGE_SIZE < quotes.length ? String(start + QUOTES_PAGE_SIZE) : null };
    return page;
  }),
  createMockRoute("PATCH", "/api/v1/posts/:postId/reply-settings", ({ params, body }) => {
    const replyPolicy = (body as { replyPolicy?: ReplyPolicy } | null)?.replyPolicy ?? "everyone";
    const post = mockPostsState.get(params.postId!);
    if (post && post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "Only the author can change who can reply.", "NOT_POST_AUTHOR");
    return updatePost(params.postId!, (current) => ({ ...current, replyPolicy, viewerCanReply: true, replyRestriction: null }));
  }),
  createMockRoute("PATCH", "/api/v1/posts/:postId/sensitivity", ({ params, body }) => {
    const labels = (body as { sensitiveLabels?: SensitiveLabel[] } | null)?.sensitiveLabels ?? [];
    return updatePost(params.postId!, (current) => ({ ...current, sensitive: labels.length === 0 ? null : { labels, requiresInterstitial: false } }));
  }),
  createMockRoute("GET", "/api/v1/me/content-preferences", ({ isGuest }) => describePreferences(isGuest)),
  createMockRoute("PUT", "/api/v1/me/content-preferences", ({ body, isGuest }) => {
    if (isGuest) throw new ApiError(401, "Sign in to continue.");
    contentPreferences.showSensitiveWithoutWarning = (body as { showSensitiveWithoutWarning?: boolean } | null)?.showSensitiveWithoutWarning === true;
    applySensitivePreferenceToEveryPost(contentPreferences.showSensitiveWithoutWarning);
    return describePreferences(false);
  }),
];
