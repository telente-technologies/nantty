import type { Comment, Media, Page, UserSummary } from "@/types";
import { THREAD_AD_SLOT_KIND, isQuoteThreadItem, type ThreadAdDecision, type ThreadDecidedAd, type ThreadReply, type ThreadSort } from "@/types/postThread.type";

import { commentsForPost, directRepliesOf, findCommentAnywhere } from "./comments.mock";
import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { withCommentViewerSavedState } from "./savedEntries.mock";
import { postImageUrlsForPhotoKey } from "./mockImages.mock";
import { findPostIncludingSponsored } from "./posts.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { mergeQuotesIntoRankedComments, mockQuoteItemsFor, newestQuotesFirst } from "./commentSectionQuotes.mock";
import { decideStoryAdMock } from "./storyAds.mock";
import { chooseMockChain, rankMockTopLevelComments, withMockQuoteState } from "./quoteLinks.mock";

const CONVERSATION_PAGE_SIZE = 6;
const REPLIES_PAGE_SIZE = 4;
const MAXIMUM_INLINE_DEPTH = 2;
const MAXIMUM_THREAD_DEPTH = 3;
const FIRST_AD_SLOT_AFTER_REPLIES = 3;
const REPLIES_BETWEEN_ADS = 8;
const AD_EXPIRY_MS = 15 * 60_000;
const PERSONALISED_ADS_OPT_OUT_USER_IDS: ReadonlySet<string> = new Set(["u_buyer"]);

const replyMediaByTextPrefix: Record<string, readonly Media[]> = {
  "I bought this last month": [{ type: "image", url: postImageUrlsForPhotoKey("weddingAsoEbi")[0] ?? null, width: 1080, height: 1350 }],
};

const authorRepliesByPostId = new Map<string, Comment>();

const authorReplyFor = (postId: string): Comment | null => {
  const post = findPostIncludingSponsored(postId);
  const firstThread = commentsForPost(postId).find((c) => c.parentCommentId === null);
  if (!post || !firstThread) return null;
  if (!authorRepliesByPostId.has(postId)) {
    authorRepliesByPostId.set(postId, {
      id: `cm_${postId}_author_reply`,
      postId,
      parentCommentId: firstThread.id,
      rootCommentId: firstThread.id,
      author: post.author as UserSummary,
      text: `@${firstThread.author.username} Enugu delivery takes 2 to 4 working days, and every order is covered by escrow.`,
      mentions: [{ userId: firstThread.author.id, username: firstThread.author.username, start: 0, length: firstThread.author.username.length + 1 }],
      createdAt: isoDateHoursAgo(19.5),
      likes: 88,
      liked: false,
      bookmarked: false,
      replyCount: 0,
      replyingTo: { userId: firstThread.author.id, username: firstThread.author.username },
    });
  }
  return authorRepliesByPostId.get(postId)!;
};

const repliesOf = (postId: string, parentId: string): Comment[] => {
  const stored = directRepliesOf(postId, parentId);
  const authorReply = authorReplyFor(postId);
  return authorReply?.parentCommentId === parentId ? [authorReply, ...stored] : stored;
};

const toThreadReply = (comment: Comment, postAuthorId: string | null, depth: number, hasParentAbove: boolean, maximumDepth = MAXIMUM_INLINE_DEPTH, includeEveryChild = false, chainIds?: ReadonlySet<string>): ThreadReply => {
  const children = repliesOf(comment.postId, comment.id);
  const preferred = children.find((c) => c.author.id === postAuthorId) ?? children[0];
  const chosen = includeEveryChild ? children : chainIds ? children.filter((child) => chainIds.has(child.id)) : preferred ? [preferred] : [];
  const inline = depth < maximumDepth ? chosen.map((child, index) => toThreadReply(child, postAuthorId, depth + 1, index === 0, maximumDepth, includeEveryChild, chainIds)) : [];
  const media = Object.entries(replyMediaByTextPrefix).find(([prefix]) => comment.text.startsWith(prefix))?.[1];
  const viewed = withMockQuoteState(withCommentViewerSavedState(comment), postAuthorId ?? undefined);
  return {
    ...viewed,
    replyCount: children.length,
    ...(media ? { media } : {}),
    isPostAuthor: comment.author.id === postAuthorId,
    connector: { depth, hasParentAbove, hasChildBelow: inline.length > 0, isLastInChain: inline.length === 0 },
    inlineReplies: inline,
    hasMoreReplies: depth < maximumDepth && children.length > inline.length,
    continuesInThread: depth >= maximumDepth && children.length > 0,
  };
};

const sortConversation = (comments: readonly Comment[], sort: ThreadSort) =>
  [...comments].sort((a, b) =>
    Number(b.isPinned === true) - Number(a.isPinned === true) ||
    (sort === "latest"
      ? b.createdAt.localeCompare(a.createdAt)
      : sort === "likes"
        ? b.likes - a.likes || b.createdAt.localeCompare(a.createdAt)
        : b.likes + b.replyCount * 5 - (a.likes + a.replyCount * 5)),
  );

const paginate = <T>(items: readonly T[], cursor: string | null, pageSize: number): Page<T> => {
  const start = Number(cursor ?? 0);
  return { data: items.slice(start, start + pageSize), nextCursor: start + pageSize < items.length ? String(start + pageSize) : null };
};

const sponsoredCreatives: readonly Omit<ThreadDecidedAd, "adId" | "impressionToken" | "expiresAt">[] = [
  {
    placement: "feed",
    slotKind: THREAD_AD_SLOT_KIND,
    format: "product",
    label: "Promoted",
    creative: {
      format: "product",
      media: [{ id: "md_ad_thread_1", kind: "image", url: postImageUrlsForPhotoKey("jollofRice")[0] ?? "", posterUrl: null, width: 1080, height: 720 }],
      headline: "Party jollof trays, delivered hot",
      primaryText: "Order for 10 to 200 guests. Escrow-protected, delivered across Lagos the same day.",
      callToAction: "Order now",
      destination: { type: "url", targetId: null, url: "https://nantty.com/stores/st_mama_put" },
      identity: { name: "Mama Put Kitchens", handle: "mamaputkitchens", avatarUrl: null, verifiedBusiness: true },
    },
  },
  {
    placement: "feed",
    slotKind: THREAD_AD_SLOT_KIND,
    format: "feed_post",
    label: "Promoted",
    creative: {
      format: "feed_post",
      media: [{ id: "md_ad_thread_2", kind: "image", url: postImageUrlsForPhotoKey("lagosSkyline")[0] ?? "", posterUrl: null, width: 1080, height: 720 }],
      headline: "Ship anywhere in Nigeria from N1,500",
      primaryText: "Book pickup in the app and track every parcel to the doorstep.",
      callToAction: "Learn more",
      destination: { type: "url", targetId: null, url: "https://nantty.com/help/shipping" },
      identity: { name: "Zudo Logistics", handle: "zudologistics", avatarUrl: null, verifiedBusiness: true },
    },
  },
  {
    placement: "feed",
    slotKind: THREAD_AD_SLOT_KIND,
    format: "feed_post",
    label: "Promoted",
    clickLinks: { cards: ["https://api.zudomart.com/api/v1/ads/r/mock-thread-0", "https://api.zudomart.com/api/v1/ads/r/mock-thread-1"] },
    creative: {
      type: "carousel",
      format: "feed_post",
      media: [],
      cards: [
        { media: { id: "md_ad_thread_c1", kind: "image", url: postImageUrlsForPhotoKey("jollofRice")[0] ?? "", posterUrl: null, width: 1080, height: 1080 }, headline: "Party trays", description: "10 to 200 guests", callToAction: "order_now", destination: { type: "url", targetId: null, url: "https://nantty.com/stores/st_mama_put" } },
        { media: { id: "md_ad_thread_c2", kind: "image", url: postImageUrlsForPhotoKey("lagosSkyline")[0] ?? "", posterUrl: null, width: 1080, height: 1080 }, headline: "Same-day delivery", callToAction: "learn_more", destination: { type: "store", targetId: "st_mama_put", url: null } },
      ],
      headline: "Mama Put Kitchens",
      primaryText: "Two ways to order. Swipe through.",
      callToAction: "learn_more",
      destination: { type: "url", targetId: null, url: "https://nantty.com/stores/st_mama_put" },
      identity: { name: "Mama Put Kitchens", handle: "mamaputkitchens", avatarUrl: null, verifiedBusiness: true },
    },
  },
];

interface ThreadSlotRequest {
  readonly kind?: string;
  readonly contentId?: string;
  readonly slotIndex?: number;
  readonly slotsSinceLastAd?: number;
}

const decideThreadAd = (slot: ThreadSlotRequest, viewerUserId: string | null): ThreadAdDecision => {
  if (slot.kind !== THREAD_AD_SLOT_KIND) return { ad: null, declinedReason: "unknownSlotKind" };
  const slotIndex = slot.slotIndex ?? 0;
  const minimumGap = slotIndex === 0 ? FIRST_AD_SLOT_AFTER_REPLIES : REPLIES_BETWEEN_ADS;
  if ((slot.slotsSinceLastAd ?? 0) < minimumGap) return { ad: null, declinedReason: "frequencyCap" };
  const creative = sponsoredCreatives[slotIndex % sponsoredCreatives.length]!;
  const isContextualOnly = viewerUserId !== null && PERSONALISED_ADS_OPT_OUT_USER_IDS.has(viewerUserId);
  if (isContextualOnly && creative.format !== "product") return { ad: null, declinedReason: "contextualOnly" };
  return {
    ad: {
      ...creative,
      adId: `ad_thread_${slot.contentId ?? "post"}_${slotIndex}`,
      impressionToken: `imp_${Date.now().toString(36)}_${slotIndex}`,
      expiresAt: new Date(Date.now() + AD_EXPIRY_MS).toISOString(),
    },
  };
};

export const postThreadMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/thread", ({ params, query, isGuest }) => {
    const postId = params.postId!;
    const postAuthorId = findPostIncludingSponsored(postId)?.author.id ?? null;
    if (query.get("filter") === "quotes") return paginate(newestQuotesFirst(mockQuoteItemsFor(postId, postAuthorId, isGuest)), query.get("cursor"), CONVERSATION_PAGE_SIZE);
    const rawSort = query.get("sort");
    const sort: ThreadSort = rawSort === "latest" || rawSort === "likes" ? rawSort : "relevant";
    const everyComment = commentsForPost(postId);
    const roots = everyComment.filter((c) => c.parentCommentId === null);
    const topLevel = sort === "relevant" ? rankMockTopLevelComments(roots, everyComment, postAuthorId ?? undefined) : sortConversation(roots, sort);
    if (sort !== "relevant") {
      const page = paginate(topLevel, query.get("cursor"), CONVERSATION_PAGE_SIZE);
      return { data: page.data.map((c) => toThreadReply(c, postAuthorId, 0, false)), nextCursor: page.nextCursor };
    }
    const page = paginate(mergeQuotesIntoRankedComments(topLevel, mockQuoteItemsFor(postId, postAuthorId, isGuest), postAuthorId), query.get("cursor"), CONVERSATION_PAGE_SIZE);
    const withAuthorReplies = [...everyComment, ...(authorReplyFor(postId) ? [authorReplyFor(postId)!] : [])];
    return {
      data: page.data.map((c) => (isQuoteThreadItem(c) ? c : toThreadReply(c, postAuthorId, 0, false, 3, false, new Set(chooseMockChain(c, withAuthorReplies, postAuthorId ?? undefined).map((reply) => reply.id))))),
      nextCursor: page.nextCursor,
    };
  }),
  createMockRoute("GET", "/api/v1/comments/:commentId/thread", ({ params, query }) => {
    const parent = findCommentAnywhere(params.commentId!) ?? [...authorRepliesByPostId.values()].find((c) => c.id === params.commentId);
    if (!parent) return { data: [], nextCursor: null };
    const postAuthorId = findPostIncludingSponsored(parent.postId)?.author.id ?? null;
    const ancestors: Comment[] = [];
    let cursor: Comment | undefined = findCommentAnywhere(parent.parentCommentId ?? "");
    while (cursor) {
      ancestors.unshift(cursor);
      cursor = cursor.parentCommentId ? findCommentAnywhere(cursor.parentCommentId) : undefined;
    }
    const page = paginate(repliesOf(parent.postId, parent.id), query.get("cursor"), REPLIES_PAGE_SIZE);
    return {
      data: page.data.map((c, index) => toThreadReply(c, postAuthorId, 1, index === 0, MAXIMUM_THREAD_DEPTH, true)),
      nextCursor: page.nextCursor,
      focus: withCommentViewerSavedState(parent),
      ancestors,
      maximumVisibleDepth: MAXIMUM_THREAD_DEPTH,
    };
  }),
  createMockRoute("POST", "/api/v1/ads/decide", ({ body, isGuest }) => {
    const { slot } = (body ?? {}) as { slot?: ThreadSlotRequest };
    if (slot?.kind === "story") return decideStoryAdMock(slot ?? {}, isGuest ? null : getSignedInMockUser().id);
    return decideThreadAd(slot ?? {}, isGuest ? null : getSignedInMockUser().id);
  }),
];
