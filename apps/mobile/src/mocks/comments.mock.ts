import { ApiError } from "@/errors/api.error";
import type { Comment, CommentVideoReply, CommentWithReplies, NewCommentInput, Page, UserSummary } from "@/types";

import { isoDateHoursAgo, me } from "./fixtures.mock";
import { withCommentViewerSavedState } from "./savedEntries.mock";
import { notifyMentionedUsers, sanitizeMentionsForWrite, userIdsWhoBlockedTheAuthor } from "./mentionRules.mock";
import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { chooseMockChain, mockPostAuthorId, rankMockTopLevelComments, resolveMockQuote, withMockQuoteState } from "./quoteLinks.mock";
import { quotedSummaryFromPost } from "@/utils/postLinks.util";

const TOP_LEVEL_PAGE_SIZE = 6;
const REPLIES_PAGE_SIZE = 4;
const PREVIEW_REPLY_COUNT = 3;

const buildCommenter = (id: string, name: string, username: string, verified = false): UserSummary => ({
  id,
  name,
  username,
  avatarUrl: null,
  verified,
});

const commenters = {
  adaeze: buildCommenter("u_c_adaeze", "Adaeze Okafor", "adaeze.styles", true),
  tunde: buildCommenter("u_c_tunde", "Tunde Bakare", "tundebakes"),
  chioma: buildCommenter("u_c_chioma", "Chioma Nwosu", "chiomas_closet"),
  emeka: buildCommenter("u_c_emeka", "Emeka Obi", "emeka_gadgets", true),
  funke: buildCommenter("u_c_funke", "Funke Adeyemi", "funkeglow"),
  ibrahim: buildCommenter("u_c_ibrahim", "Ibrahim Musa", "ibro_kicks"),
  ngozi: buildCommenter("u_c_ngozi", "Ngozi Eze", "ngozi.eats"),
  segun: buildCommenter("u_c_segun", "Segun Alade", "segunlagos"),
};

interface SeedComment {
  readonly author: UserSummary;
  readonly text: string;
  readonly hoursAgo: number;
  readonly likes: number;
  readonly replies?: readonly SeedComment[];
}

const seedThreads: readonly SeedComment[] = [
  {
    author: commenters.adaeze,
    text: "This fabric is so clean! Abeg how much for delivery to Enugu?",
    hoursAgo: 20,
    likes: 342,
    replies: [
      {
        author: commenters.emeka,
        text: "They delivered mine to Nsukka in 3 days, no wahala",
        hoursAgo: 19,
        likes: 41,
        replies: [
          {
            author: commenters.adaeze,
            text: "3 days? That's fast o. Did you pay on delivery or escrow?",
            hoursAgo: 18,
            likes: 12,
            replies: [
              {
                author: commenters.emeka,
                text: "Escrow. Money only released after I confirmed. Very safe",
                hoursAgo: 17,
                likes: 30,
                replies: [{ author: commenters.funke, text: "Escrow is the best thing on this app honestly", hoursAgo: 16, likes: 8 }],
              },
            ],
          },
        ],
      },
      { author: commenters.chioma, text: "Same question! Enugu people rise up 🙌🏾", hoursAgo: 18, likes: 17 },
      { author: commenters.tunde, text: "Check the shipping info on the product page, it shows per state", hoursAgo: 15, likes: 9 },
      { author: me, text: "Delivery to Enugu is about 2-4 working days", hoursAgo: 14, likes: 22 },
      { author: commenters.segun, text: "Lagos to Enugu is usually 3 days with most sellers", hoursAgo: 12, likes: 4 },
    ],
  },
  { author: commenters.tunde, text: "The quality in the video looks better than the pictures sha 🔥", hoursAgo: 16, likes: 128 },
  {
    author: commenters.funke,
    text: "I bought this last month and I'm still enjoying it. Seller is legit!",
    hoursAgo: 14,
    likes: 96,
    replies: [
      { author: commenters.ngozi, text: "Thank you for this review, I was about to ask", hoursAgo: 13, likes: 6 },
      {
        author: commenters.ibrahim,
        text: "Does the colour fade after washing?",
        hoursAgo: 12,
        likes: 3,
        replies: [{ author: commenters.funke, text: "Not at all. Hand wash with cold water and you're fine", hoursAgo: 11, likes: 14 }],
      },
    ],
  },
  { author: commenters.ibrahim, text: "Do you have size 44? My leg no small 😂", hoursAgo: 10, likes: 57 },
  {
    author: commenters.ngozi,
    text: "Price don increase since last week abi na me?",
    hoursAgo: 9,
    likes: 44,
    replies: [{ author: commenters.segun, text: "Everything don cost o, na the dollar rate", hoursAgo: 8, likes: 19 }],
  },
  { author: commenters.chioma, text: "Wow! Adding this to my cart right now", hoursAgo: 7, likes: 21 },
  { author: commenters.segun, text: "Seller please drop more colours 🙏🏾", hoursAgo: 6, likes: 13 },
  { author: commenters.emeka, text: "Watched this three times. The transitions are sweet", hoursAgo: 4, likes: 8 },
  { author: commenters.adaeze, text: "Where can I find the matching bag?", hoursAgo: 2, likes: 2 },
];

const commentsByPostId = new Map<string, Comment[]>();
let nextCommentSequence = 1;

const createStoredComment = (
  postId: string,
  author: UserSummary,
  text: string,
  parent: Comment | null,
  hoursAgo: number,
  likes: number,
  mentions?: Comment["mentions"],
): Comment => ({
  id: `cm_${postId}_${nextCommentSequence++}`,
  postId,
  parentCommentId: parent?.id ?? null,
  rootCommentId: parent ? (parent.rootCommentId ?? parent.id) : null,
  author,
  text,
  createdAt: isoDateHoursAgo(hoursAgo),
  likes,
  liked: false,
  bookmarked: false,
  replyCount: 0,
  replyingTo: parent ? { userId: parent.author.id, username: parent.author.username } : undefined,
  ...(mentions?.length ? { mentions } : {}),
});

const flattenSeedIntoComments = (postId: string, seeds: readonly SeedComment[], parent: Comment | null, output: Comment[]) => {
  for (const seed of seeds) {
    const created = createStoredComment(postId, seed.author, seed.text, parent, seed.hoursAgo, seed.likes);
    const withReplyCount = { ...created, replyCount: seed.replies?.length ?? 0 };
    output.push(withReplyCount);
    if (seed.replies) flattenSeedIntoComments(postId, seed.replies, withReplyCount, output);
  }
};

export const commentsForPost = (postId: string): Comment[] => {
  if (!commentsByPostId.has(postId)) {
    const seeded: Comment[] = [];
    flattenSeedIntoComments(postId, seedThreads, null, seeded);
    commentsByPostId.set(postId, seeded);
  }
  return commentsByPostId.get(postId)!;
};

const videoRepliesByCommentId = new Map<string, CommentVideoReply[]>();

export const registerMockVideoReply = (commentId: string, reply: CommentVideoReply) => {
  videoRepliesByCommentId.set(commentId, [reply, ...(videoRepliesByCommentId.get(commentId) ?? [])]);
};

const withVideoReplyInfo = <T extends Comment>(comment: T): T => {
  const videoReplies = videoRepliesByCommentId.get(comment.id);
  return {
    ...comment,
    ...(videoReplies?.length ? { videoReplies } : {}),
    ...(userIdsWhoBlockedTheAuthor.has(comment.author.id) ? { videoReplyBlocked: true } : {}),
  };
};

export const findCommentAnywhere = (commentId: string): Comment | undefined => {
  for (const comments of commentsByPostId.values()) {
    const found = comments.find((c) => c.id === commentId);
    if (found) return found;
  }
  return undefined;
};

const replaceStoredComment = (commentId: string, change: (comment: Comment) => Comment) => {
  for (const [postId, comments] of commentsByPostId) {
    if (comments.some((c) => c.id === commentId))
      commentsByPostId.set(
        postId,
        comments.map((c) => (c.id === commentId ? change(c) : c)),
      );
  }
};

export const directRepliesOf = (postId: string, parentId: string) => commentsForPost(postId).filter((c) => c.parentCommentId === parentId);

const paginateByOffset = <T>(items: readonly T[], cursor: string | null, pageSize: number): Page<T> => {
  const start = Number(cursor ?? 0);
  return { data: items.slice(start, start + pageSize), nextCursor: start + pageSize < items.length ? String(start + pageSize) : null };
};

const collectDescendantIds = (postId: string, commentId: string): string[] =>
  directRepliesOf(postId, commentId).flatMap((reply) => [reply.id, ...collectDescendantIds(postId, reply.id)]);

export const commentsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/comments", ({ params, query }) => {
    const postId = params.postId!;
    const postAuthorId = mockPostAuthorId(postId);
    const everyComment = commentsForPost(postId);
    const topLevel = rankMockTopLevelComments(everyComment.filter((c) => c.parentCommentId === null), everyComment, postAuthorId);
    const page = paginateByOffset(topLevel, query.get("cursor"), TOP_LEVEL_PAGE_SIZE);
    const withPreviews: CommentWithReplies[] = page.data.map((c) => ({
      ...withMockQuoteState(withVideoReplyInfo(withCommentViewerSavedState(c)), postAuthorId),
      previewReplies: chooseMockChain(c, everyComment, postAuthorId, PREVIEW_REPLY_COUNT).map((reply) => withMockQuoteState(withVideoReplyInfo(reply), postAuthorId)),
    }));
    return { data: withPreviews, nextCursor: page.nextCursor };
  }),
  createMockRoute("GET", "/api/v1/comments/:commentId/replies", ({ params, query }) => {
    const parent = findCommentAnywhere(params.commentId!);
    if (!parent) return { data: [], nextCursor: null };
    const page = paginateByOffset(directRepliesOf(parent.postId, parent.id), query.get("cursor"), REPLIES_PAGE_SIZE);
    return { ...page, data: page.data.map((c) => withMockQuoteState(withVideoReplyInfo(withCommentViewerSavedState(c)), mockPostAuthorId(parent.postId))) };
  }),
  createMockRoute("GET", "/api/v1/comments/:commentId", ({ params }) => {
    const comment = findCommentAnywhere(params.commentId!);
    if (!comment) throw new ApiError(404, "Comment not found", "COMMENT_NOT_FOUND");
    return withMockQuoteState(withVideoReplyInfo(withCommentViewerSavedState(comment)), mockPostAuthorId(comment.postId));
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/comments", ({ params, body }) => {
    const postId = params.postId!;
    const input = body as NewCommentInput;
    const targetPost = mockPostsState.get(postId);
    if (targetPost?.viewerCanReply === false && targetPost.author.id !== me.id) throw new ApiError(403, targetPost.replyRestriction?.message ?? "You can't reply to this post.", targetPost.replyRestriction?.reason ?? "REPLIES_OFF");
    const parent = input.parentCommentId ? (findCommentAnywhere(input.parentCommentId) ?? null) : null;
    const sanitized = sanitizeMentionsForWrite(me, input.mentions, "comment");
    const quote = resolveMockQuote(input.text, input.quotedPostId);
    const stored = createStoredComment(postId, me, quote?.text ?? input.text, parent, 0, 0, sanitized.mentions);
    const created = withMockQuoteState(quote ? { ...stored, quotedPost: quotedSummaryFromPost(quote.original) } : stored, targetPost?.author.id);
    notifyMentionedUsers(me, sanitized, "comment");
    const comments = commentsForPost(postId);
    commentsByPostId.set(postId, parent ? [...comments, created] : [created, ...comments]);
    if (parent) replaceStoredComment(parent.id, (c) => ({ ...c, replyCount: c.replyCount + 1 }));
    return created;
  }),
  createMockRoute("POST", "/api/v1/comments/:commentId/like", ({ params }) =>
    replaceStoredComment(params.commentId!, (c) => (c.liked ? c : { ...c, liked: true, likes: c.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/comments/:commentId/like", ({ params }) =>
    replaceStoredComment(params.commentId!, (c) => (c.liked ? { ...c, liked: false, likes: c.likes - 1 } : c)),
  ),
  createMockRoute("PUT", "/api/v1/posts/:postId/comments/:commentId/pin", ({ params }) => {
    const post = mockPostsState.get(params.postId!);
    if (!post) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
    if (post.author.id !== me.id) throw new ApiError(403, "Only the post author can pin a comment.", "FORBIDDEN");
    const comment = findCommentAnywhere(params.commentId!);
    if (!comment || comment.postId !== params.postId) throw new ApiError(404, "Comment not found", "COMMENT_NOT_FOUND");
    if (comment.parentCommentId !== null) throw new ApiError(422, "Only top-level comments can be pinned.", "COMMENT_NOT_PINNABLE");
    if (comment.isPinned === true) return withCommentViewerSavedState(comment);
    for (const other of commentsForPost(post.id)) {
      if (other.isPinned === true) replaceStoredComment(other.id, (c) => ({ ...c, isPinned: false, pinnedAt: null }));
    }
    mockPostsState.set(post.id, { ...post, pinnedCommentId: comment.id });
    replaceStoredComment(comment.id, (c) => ({ ...c, isPinned: true, pinnedAt: new Date().toISOString() }));
    return withCommentViewerSavedState(findCommentAnywhere(comment.id)!);
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId/comments/:commentId/pin", ({ params }) => {
    const post = mockPostsState.get(params.postId!);
    if (!post) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
    if (post.author.id !== me.id) throw new ApiError(403, "Only the post author can unpin a comment.", "FORBIDDEN");
    const comment = findCommentAnywhere(params.commentId!);
    if (!comment || comment.postId !== params.postId) throw new ApiError(404, "Comment not found", "COMMENT_NOT_FOUND");
    replaceStoredComment(comment.id, (c) => ({ ...c, isPinned: false, pinnedAt: null }));
    if (post.pinnedCommentId === comment.id) mockPostsState.set(post.id, { ...post, pinnedCommentId: null });
  }),
  createMockRoute("DELETE", "/api/v1/comments/:commentId", ({ params }) => {
    const comment = findCommentAnywhere(params.commentId!);
    if (!comment) throw new ApiError(404, "Comment not found");
    if (comment.author.id !== me.id) throw new ApiError(403, "You can only delete your own comments", "FORBIDDEN");
    const removedIds = new Set([comment.id, ...collectDescendantIds(comment.postId, comment.id)]);
    commentsByPostId.set(
      comment.postId,
      commentsForPost(comment.postId).filter((c) => !removedIds.has(c.id)),
    );
    if (comment.parentCommentId) replaceStoredComment(comment.parentCommentId, (c) => ({ ...c, replyCount: Math.max(0, c.replyCount - 1) }));
    const post = mockPostsState.get(comment.postId);
    if (post?.pinnedCommentId === comment.id) mockPostsState.set(post.id, { ...post, pinnedCommentId: null });
  }),
];
