import { notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { buildExcerpt, resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { keepMentionsWithinText, prepareMentionsForWrite } from "../../../mentions/services/mentionWrite.service.js";
import { displayTextForQuote, recordReshareInTransaction, resolveQuoteForWrite } from "../../../posts/services/quoteTarget.service.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { assertViewerMayReplyToPost } from "../../../posts/services/replyPolicy.service.js";
import { placeReplyUnderParent } from "../../services/commentThread.service.js";
import type { CommentView } from "../../models/comment.model.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import { buildCommentViews } from "../../services/commentView.service.js";
import { findCommentVisibleToViewer, isHiddenOrUnderHidden, lockPostCommentCounts } from "../../services/commentVisibility.service.js";
import type { CreateCommentCommand } from "./createComment.command.js";

export function createCreateCommentHandler(context: HandlerContext): Handler<CreateCommentCommand, CommentView> {
  return async (command) => {
    const text = command.text.trim();
    if (text === "" || text.length > 1500) throw unprocessable("COMMENT_TEXT_INVALID", "Comments need 1 to 1500 characters.");
    const post = await loadPostVisibleToViewer(context, command.authorId, command.postId);
    const parent = command.parentCommentId === undefined ? null : await findCommentVisibleToViewer(context.database.client, command.parentCommentId, command.authorId);
    if (command.parentCommentId !== undefined && (parent === null || parent.postId !== post.id)) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
    await assertViewerMayReplyToPost(context, command.authorId, post);
    const placement = placeReplyUnderParent(parent);
    const quote = await resolveQuoteForWrite(context, command.authorId, { text: command.text, quotedPostId: command.quotedPostId });
    const storedText = displayTextForQuote(command.text, quote);
    const mentionResult = await prepareMentionsForWrite(context, { surface: "comment", authorId: command.authorId, text: storedText, entities: keepMentionsWithinText(command.mentions, storedText) });
    const now = context.clock.now();
    const actor = await resolveEventActor(context.directory, command.authorId);
    const created = await context.database.transaction(async (transaction) => {
      if (!(await lockPostCommentCounts(transaction, post.id))) throw notFound("POST_NOT_FOUND", "This post was deleted, so your comment wasn't posted.");
      const silent = parent !== null && (await isHiddenOrUnderHidden(transaction, parent));
      if (!silent) await postRepository.incrementCounter(transaction, post.id, "commentCount", 1);
      const comment = await commentRepository.create(transaction, {
        postId: post.id,
        authorId: command.authorId,
        text: storedText,
        ...(quote === null ? {} : { quotedPostId: quote.originalId }),
        mentions: mentionResult.entities as unknown as Prisma.InputJsonValue,
        createdAt: now,
        depth: placement.depth,
        path: placement.path,
        ...(placement.parentCommentId === null ? {} : { parentCommentId: placement.parentCommentId, rootCommentId: placement.rootCommentId }),
      });
      if (parent !== null) await commentRepository.incrementReplies(transaction, parent.id, 1);
      const events: DomainEventInput[] = [];
      const excerpt = buildExcerpt(storedText);
      const url = `/post/${post.id}?comment=${comment.id}`;
      const recipients = new Set<string>(silent ? [] : [post.authorId, ...(parent === null ? [] : [parent.authorId])]);
      recipients.delete(command.authorId);
      for (const recipientUserId of recipients) {
        events.push({ eventType: socialEventTypes.commentCreated, subject: comment.id, occurredAt: now, data: { recipientUserId, actor, target: parent !== null && recipientUserId === parent.authorId ? "reply" : "post", excerpt, url, commentId: comment.id, postId: post.id, postAuthorId: post.authorId, topics: post.topics, actorId: command.authorId, authorId: command.authorId, parentCommentId: parent?.id ?? null, quotedPostId: quote?.originalId ?? null } });
      }
      for (const userId of silent ? [] : mentionResult.userIdsToNotify) events.push({ eventType: socialEventTypes.mentionCreated, subject: comment.id, occurredAt: now, data: { recipientUserId: userId, mentionedUserId: userId, actor, authorId: command.authorId, surface: "comment", postId: post.id, commentId: comment.id, excerpt, url } });
      await appendDomainEventsToOutbox(transaction, events);
      if (quote !== null) await recordReshareInTransaction(transaction, { postId: post.id, commentId: comment.id, originalId: quote.originalId, actorId: command.authorId, originalAuthorId: quote.originalAuthorId, isQuote: true, now, actor });
      return comment;
    });
    const [view] = await buildCommentViews(context, command.authorId, [created], post.authorId);
    return view as CommentView;
  };
}
