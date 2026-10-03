import { unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { storyLifetimeHours } from "../../../../constants/social.constant.js";
import { prepareMentionsForWrite } from "../../../mentions/services/mentionWrite.service.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildPostViews } from "../../services/postView.service.js";
import { assertMediaFitsPostKind } from "../../services/postRules.service.js";
import { assertAuthorMayReplyToCommentWithVideo } from "../../services/videoReplyRules.service.js";
import type { CreatePostCommand } from "./createPost.command.js";

const maximumTextLength = 2200;

export function createCreatePostHandler(context: HandlerContext): Handler<CreatePostCommand, PostView> {
  return async (command) => {
    if (command.text.length > maximumTextLength) throw unprocessable("TEXT_TOO_LONG", `Text can be up to ${maximumTextLength} characters.`);
    const descriptors = command.mediaIds.map((mediaId) => command.media.find((candidate) => candidate.id === mediaId));
    if (descriptors.some((descriptor) => descriptor === undefined)) throw unprocessable("MEDIA_NOT_FOUND", "Every media id needs a matching media descriptor.");
    const media = descriptors.flatMap((descriptor) => (descriptor === undefined ? [] : [descriptor]));
    assertMediaFitsPostKind(command.kind, command.text, media);
    if (command.replyToComment === undefined && command.stickerLayout !== undefined) throw unprocessable("STICKER_WITHOUT_REPLY", "A sticker layout needs a comment to reply to.");
    const comment = command.replyToComment === undefined ? undefined : await assertAuthorMayReplyToCommentWithVideo(context, command.authorId, command.kind, command.replyToComment);
    const mentionResult = await prepareMentionsForWrite(context, { surface: "post", authorId: command.authorId, text: command.text, entities: command.mentions });
    const now = context.clock.now();
    const created = await context.database.transaction(async (transaction) => {
      const post = await postRepository.create(transaction, {
        authorId: command.authorId,
        kind: command.kind,
        text: command.text,
        audience: command.audience,
        visibility: command.visibility,
        isAiGenerated: command.isAiGenerated,
        mentions: mentionResult.entities as unknown as Prisma.InputJsonValue,
        createdAt: now,
        ...(command.soundId === undefined ? {} : { soundId: command.soundId }),
        ...(command.kind === "story" ? { expiresAt: new Date(now.getTime() + storyLifetimeHours * 3_600_000) } : {}),
        ...(command.replyToComment === undefined ? {} : { replyToCommentId: command.replyToComment.commentId, replyToClipId: command.replyToComment.clipId, replyToCommenterId: command.replyToComment.commenterUserId }),
        ...(command.stickerLayout === undefined ? {} : { stickerLayout: command.stickerLayout as unknown as Prisma.InputJsonValue }),
        media: {
          create: media.map((item, position) => ({
            mediaId: item.id, position, type: item.type, url: item.url ?? null, posterUrl: item.posterUrl ?? null, hlsUrl: item.hlsUrl ?? null,
            width: item.width ?? null, height: item.height ?? null, durationSeconds: item.durationSeconds ?? null, blurhash: item.blurhash ?? null,
          })),
        },
      });
      const events: DomainEventInput[] = [{ eventType: socialEventTypes.postCreated, subject: post.id, occurredAt: now, data: { postId: post.id, authorId: post.authorId, kind: post.kind, audience: post.audience, visibility: post.visibility, isAiGenerated: post.isAiGenerated } }];
      for (const userId of mentionResult.userIdsToNotify) {
        events.push({ eventType: socialEventTypes.mentionCreated, subject: post.id, occurredAt: now, data: { mentionedUserId: userId, authorId: command.authorId, surface: "post", postId: post.id } });
      }
      if (comment !== undefined) {
        events.push({ eventType: socialEventTypes.videoReplyPublished, subject: post.id, occurredAt: now, data: { replyClipId: post.id, originalClipId: comment.postId, commentId: comment.id, authorId: command.authorId, commenterId: comment.authorId } });
      }
      await appendDomainEventsToOutbox(transaction, events);
      return post;
    });
    const [view] = await buildPostViews(context, command.authorId, [created]);
    return view as PostView;
  };
}
