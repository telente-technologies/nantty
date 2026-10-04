import { ApiError } from "@/errors/api.error";
import type { ContentPreferences, Page, Post, ReplyPolicy } from "@/types";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { mockPostsState, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const QUOTES_PAGE_SIZE = 10;
const quotesByOriginalId = new Map<string, Post[]>();
const contentPreferences = { showSensitiveWithoutWarning: false };

const updatePost = (postId: string, change: (post: Post) => Post): Post => {
  const post = mockPostsState.get(postId);
  if (!post) throw new ApiError(404, "This post was removed");
  const updated = change(post);
  mockPostsState.set(postId, updated);
  return updated;
};

const seedQuote = (id: string, originalId: string, authorPostId: string, hoursAgo: number, text: string, likes: number) => {
  const author = mockPostsState.get(authorPostId)?.author;
  if (!author || !mockPostsState.has(originalId)) return;
  const quote: Post = {
    id, kind: "post", author, createdAt: isoDateHoursAgo(hoursAgo), text, media: [], likes, comments: 2, reposts: 0, views: likes * 14,
    liked: false, bookmarked: false, saveCount: 0, isFollowingAuthor: false, friendsLiked: null, products: [], sponsored: null,
    isQuote: true, quotes: 0, replyPolicy: "everyone", viewerCanReply: true, replyRestriction: null, sensitive: null,
  };
  quotesByOriginalId.set(originalId, [...(quotesByOriginalId.get(originalId) ?? []), quote]);
  updatePost(originalId, (post) => ({ ...post, quotes: (post.quotes ?? 0) + 1 }));
};

const restrictions: Readonly<Record<string, { readonly policy: ReplyPolicy; readonly reason: "REPLIES_OFF" | "FOLLOWERS_ONLY" | "MENTIONED_ONLY"; readonly message: string }>> = {
  post_2: { policy: "mentioned", reason: "MENTIONED_ONLY", message: "Only people mentioned in this post can reply." },
  post_10: { policy: "off", reason: "REPLIES_OFF", message: "The author turned off replies for this post." },
  post_12: { policy: "followers", reason: "FOLLOWERS_ONLY", message: "Only the author's followers can reply." },
};
for (const [postId, restriction] of Object.entries(restrictions)) {
  if (mockPostsState.has(postId)) updatePost(postId, (post) => ({ ...post, replyPolicy: restriction.policy, viewerCanReply: false, replyRestriction: { reason: restriction.reason, message: restriction.message } }));
}
if (mockPostsState.has("post_14")) updatePost("post_14", (post) => ({ ...post, sensitive: { labels: ["dangerous_acts"], requiresInterstitial: true } }));
seedQuote("quote_post_3_a", "post_3", "post_2", 7, "Surulere is underrated for jollof. Try the spot by the stadium next, the plantain alone is worth it.", 86);
seedQuote("quote_post_3_b", "post_3", "post_8", 5, "Part 7 and still no Ibadan entry? We need to talk.", 41);

const describePreferences = (): ContentPreferences => ({ showSensitiveWithoutWarning: contentPreferences.showSensitiveWithoutWarning, canChangeSensitiveContentSetting: true, ageBracket: "adult" });

export const postAudienceMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/quotes", ({ params, query }) => {
    const quotes = [...(quotesByOriginalId.get(params.postId!) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = Number(query.get("cursor") ?? 0);
    const page: Page<Post> = { data: quotes.slice(start, start + QUOTES_PAGE_SIZE).map(withCurrentProductPrices), nextCursor: start + QUOTES_PAGE_SIZE < quotes.length ? String(start + QUOTES_PAGE_SIZE) : null };
    return page;
  }),
  createMockRoute("PATCH", "/api/v1/posts/:postId/reply-settings", ({ params, body }) => {
    const post = mockPostsState.get(params.postId!);
    if (post && post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "Only the author can change who can reply.", "NOT_POST_AUTHOR");
    const replyPolicy = (body as { replyPolicy?: ReplyPolicy } | null)?.replyPolicy ?? "everyone";
    return updatePost(params.postId!, (current) => ({ ...current, replyPolicy, viewerCanReply: true, replyRestriction: null }));
  }),
  createMockRoute("GET", "/api/v1/me/content-preferences", () => describePreferences()),
  createMockRoute("PUT", "/api/v1/me/content-preferences", ({ body }) => {
    contentPreferences.showSensitiveWithoutWarning = (body as { showSensitiveWithoutWarning?: boolean } | null)?.showSensitiveWithoutWarning === true;
    for (const post of mockPostsState.values()) {
      if (post.sensitive && post.sensitive.labels.length > 0) mockPostsState.set(post.id, { ...post, sensitive: { ...post.sensitive, requiresInterstitial: !contentPreferences.showSensitiveWithoutWarning } });
    }
    return describePreferences();
  }),
];
