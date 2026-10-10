import { ApiError } from "@/errors/api.error";
import type { Comment, ID, Post } from "@/types";
import { findFirstPostLinkInText, quotedSummaryFromPost } from "@/utils/postLinks.util";

import { mockPostsState } from "./postCatalog.mock";
import { findPostIncludingSponsored } from "./posts.mock";

export interface MockQuoteResolution {
  readonly original: Post;
  readonly text: string;
}

const stripTrailingLink = (text: string, url: string) => {
  const index = text.lastIndexOf(url);
  return index >= 0 && text.slice(index + url.length).trim() === "" ? text.slice(0, index).trimEnd() : text;
};

const quotableTarget = (postId: ID): Post | undefined => {
  const target = findPostIncludingSponsored(postId);
  if (!target || target.subscriberOnly === true) return undefined;
  const embedded = target.isQuote ? target : (target.resharedFrom ?? target);
  return { ...embedded, resharedFrom: null, resharedFromUnavailable: false };
};

export function resolveMockQuote(text: string, quotedPostId: ID | null | undefined): MockQuoteResolution | null {
  if (quotedPostId === null) return null;
  const link = findFirstPostLinkInText(text);
  if (quotedPostId !== undefined) {
    const original = quotableTarget(quotedPostId);
    if (!original) throw new ApiError(422, "This post is unavailable, so it can't be quoted.", "QUOTED_POST_UNAVAILABLE");
    return { original, text: link?.postId === quotedPostId ? stripTrailingLink(text, link.url) : text };
  }
  if (!link) return null;
  const original = quotableTarget(link.postId);
  return original ? { original, text: stripTrailingLink(text, link.url) } : null;
}

export function withMockQuoteState<T extends Comment>(comment: T, postAuthorId: ID | undefined): T {
  const quotedId = comment.quotedPost?.id ?? null;
  const live = quotedId ? findPostIncludingSponsored(quotedId) : undefined;
  return {
    ...comment,
    isPostAuthor: !!postAuthorId && comment.author.id === postAuthorId,
    ...(quotedId ? { quotedPost: live ? quotedSummaryFromPost(live) : null, quotedPostUnavailable: !live } : { quotedPost: null, quotedPostUnavailable: false }),
  };
}

export const mockPostAuthorId = (postId: ID) => mockPostsState.get(postId)?.author.id;

export function rankMockTopLevelComments(topLevel: readonly Comment[], everyComment: readonly Comment[], postAuthorId: ID | undefined): Comment[] {
  const joined = new Set(everyComment.filter((comment) => comment.author.id === postAuthorId && comment.rootCommentId).map((comment) => comment.rootCommentId as ID));
  const tier = (comment: Comment) => (comment.isPinned ? 3 : comment.author.id === postAuthorId ? 2 : joined.has(comment.id) ? 1 : 0);
  const score = (comment: Comment) => (comment.likes + 2 * comment.replyCount + 1) / Math.pow((Date.now() - Date.parse(comment.createdAt)) / 3_600_000 + 2, 1.2);
  return [...topLevel].sort((left, right) => tier(right) - tier(left) || score(right) - score(left) || (left.id < right.id ? 1 : -1));
}

export function chooseMockChain(root: Comment, everyComment: readonly Comment[], postAuthorId: ID | undefined, maximumLength = 3): Comment[] {
  const childrenOf = (id: ID) => everyComment.filter((comment) => comment.parentCommentId === id);
  const chain: Comment[] = [];
  const firstAuthorReply = root.author.id === postAuthorId ? undefined : childrenOf(root.id).find((child) => child.author.id === postAuthorId);
  if (firstAuthorReply) {
    let current = firstAuthorReply;
    let expected = root.author.id;
    chain.push(current);
    while (chain.length < maximumLength) {
      const next = childrenOf(current.id).find((child) => child.author.id === expected);
      if (!next) break;
      chain.push(next);
      current = next;
      expected = expected === root.author.id ? (postAuthorId ?? "") : root.author.id;
    }
    return chain;
  }
  const top = [...childrenOf(root.id)].sort((left, right) => right.likes - left.likes || right.replyCount - left.replyCount)[0];
  if (!top) return chain;
  chain.push(top);
  const authorReply = childrenOf(top.id).find((child) => child.author.id === postAuthorId);
  if (authorReply) chain.push(authorReply);
  return chain;
}
