import { SocialError, unprocessable } from "../../../errors/social.error.js";
import { socialEventTypes } from "../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../events/outbox.event.js";
import type { EventActor } from "../../../events/actor.event.js";
import type { Db } from "../../../types/database.type.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { findFirstPostLink, stripTrailingPostLink, type PostLinkMatch } from "../../../utils/postLink.util.js";
import { postRepository, type PostRow } from "../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "./postAccess.service.js";

export interface QuoteResolution {
  readonly target: PostRow;
  readonly originalId: string;
  readonly originalAuthorId: string;
  readonly link: PostLinkMatch | null;
}

export interface QuoteRequest {
  readonly text: string;
  readonly quotedPostId: string | null | undefined;
}

export function quoteOriginalIdFor(target: PostRow): string {
  return target.isQuote ? target.id : (target.resharedFromId ?? target.id);
}

export async function originalAuthorIdFor(context: HandlerContext, target: PostRow): Promise<string> {
  const originalId = quoteOriginalIdFor(target);
  if (originalId === target.id) return target.authorId;
  return (await postRepository.findById(context.database.client, originalId))?.authorId ?? target.authorId;
}

async function toResolution(context: HandlerContext, target: PostRow, link: PostLinkMatch | null): Promise<QuoteResolution> {
  return { target, originalId: quoteOriginalIdFor(target), originalAuthorId: await originalAuthorIdFor(context, target), link };
}

export async function loadQuotableTarget(context: HandlerContext, actorId: string, postId: string): Promise<PostRow> {
  const target = await loadPostVisibleToViewer(context, actorId, postId);
  if (target.kind === "story") throw unprocessable("STORY_CANNOT_BE_RESHARED", "Stories can't be reshared.");
  if (target.visibility === "subscribers" && target.authorId !== actorId) throw unprocessable("SUBSCRIBER_POST_CANNOT_BE_RESHARED", "Subscriber-only posts can't be reshared.");
  return target;
}

async function findQuotableTarget(context: HandlerContext, actorId: string, postId: string): Promise<PostRow | null> {
  try {
    return await loadQuotableTarget(context, actorId, postId);
  } catch (error) {
    if (error instanceof SocialError && error.status < 500) return null;
    throw error;
  }
}

export async function resolveQuoteForWrite(context: HandlerContext, actorId: string, request: QuoteRequest): Promise<QuoteResolution | null> {
  if (request.quotedPostId === null) return null;
  const link = findFirstPostLink(request.text);
  if (request.quotedPostId !== undefined) {
    const target = await findQuotableTarget(context, actorId, request.quotedPostId);
    if (target === null) throw unprocessable("QUOTED_POST_UNAVAILABLE", "This post is unavailable, so it can't be quoted.");
    return toResolution(context, target, link !== null && link.postId === target.id.toLowerCase() ? link : null);
  }
  if (link === null) return null;
  const target = await findQuotableTarget(context, actorId, link.postId);
  return target === null ? null : toResolution(context, target, link);
}

export function displayTextForQuote(text: string, quote: QuoteResolution | null): string {
  const link = quote?.link ?? null;
  return link === null ? text : stripTrailingPostLink(text, link);
}

export interface RecordQuoteInput {
  readonly postId: string;
  readonly originalId: string;
  readonly actorId: string;
  readonly originalAuthorId: string;
  readonly isQuote: boolean;
  readonly now: Date;
  readonly actor: EventActor;
  readonly commentId?: string;
}

export async function recordReshareInTransaction(transaction: Db, input: RecordQuoteInput): Promise<void> {
  const inComment = input.commentId !== undefined;
  if (!inComment) await postRepository.incrementCounter(transaction, input.originalId, "repostCount", 1);
  if (input.isQuote) await postRepository.incrementCounter(transaction, input.originalId, "quoteCount", 1);
  await appendDomainEventsToOutbox(transaction, [{
    eventType: socialEventTypes.postReshared, subject: input.commentId ?? input.postId, occurredAt: input.now,
    data: {
      postId: input.postId, originalPostId: input.originalId, authorId: input.actorId, originalAuthorId: input.originalAuthorId, isQuote: input.isQuote, actor: input.actor,
      surface: inComment ? "comment" : "post", commentId: input.commentId ?? null,
      url: inComment ? `/post/${input.postId}?comment=${input.commentId}` : `/post/${input.postId}`,
    },
  }]);
}
