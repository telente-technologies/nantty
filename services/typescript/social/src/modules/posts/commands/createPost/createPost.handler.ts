import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { buildExcerpt, resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { storyLifetimeHours } from "../../../../constants/social.constant.js";
import { soundRepository } from "../../../sounds/repositories/sound.repository.js";
import { canUseSound } from "../../../sounds/services/soundView.service.js";
import { prepareMentionsForWrite } from "../../../mentions/services/mentionWrite.service.js";
import type { PostView } from "../../models/post.model.js";
import type { LinkPreviewView } from "../../../linkPreviews/models/linkPreview.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildPostViews } from "../../services/postView.service.js";
import { assertMediaFitsPostKind } from "../../services/postRules.service.js";
import { prepareAudienceSettingsForPublishing } from "../../services/postAudienceRules.service.js";
import { assertAuthorMayReplyToCommentWithVideo } from "../../services/videoReplyRules.service.js";
import type { CreatePostCommand, MediaReferenceInput } from "./createPost.command.js";

const maximumTextLength = 2200;
const linkPreviewWaitMs = 1500;

async function attachLinkPreviewWithinBudget(context: HandlerContext, postId: string, text: string): Promise<LinkPreviewView | null> {
  if (context.linkPreviews === undefined) return null;
  const attaching = context.linkPreviews.attachLinkPreviewToPost(postId, text).catch(() => null);
  return Promise.race([attaching, new Promise<null>((resolve) => setTimeout(() => resolve(null), linkPreviewWaitMs).unref())]);
}

export function createCreatePostHandler(context: HandlerContext): Handler<CreatePostCommand, PostView> {
  return async (command) => {
    if (command.text.length > maximumTextLength) throw unprocessable("TEXT_TOO_LONG", `Text can be up to ${maximumTextLength} characters.`);
    const missingIds = command.mediaIds.filter((mediaId) => !command.media.some((candidate) => candidate.id === mediaId));
    const resolved = missingIds.length === 0 || context.media === undefined ? new Map<string, MediaReferenceInput>() : await context.media.resolveOwnedMedia(command.authorId, missingIds);
    const descriptors = command.mediaIds.map((mediaId) => command.media.find((candidate) => candidate.id === mediaId) ?? resolved.get(mediaId));
    if (descriptors.some((descriptor) => descriptor === undefined)) throw unprocessable("MEDIA_NOT_FOUND", "Every media id needs a matching media descriptor.");
    const media = descriptors.flatMap((descriptor) => (descriptor === undefined ? [] : [descriptor]));
    assertMediaFitsPostKind(command.kind, command.text, media);
    if (command.replyToComment === undefined && command.stickerLayout !== undefined) throw unprocessable("STICKER_WITHOUT_REPLY", "A sticker layout needs a comment to reply to.");
    const comment = command.replyToComment === undefined ? undefined : await assertAuthorMayReplyToCommentWithVideo(context, command.authorId, command.kind, command.replyToComment);
    if (command.soundId !== undefined) {
      if (command.kind !== "clip") throw unprocessable("SOUND_REQUIRES_CLIP", "Only clips can use a sound.");
      const sound = await soundRepository.findById(context.database.client, command.soundId);
      if (sound === null) throw notFound("SOUND_NOT_FOUND", "Sound not found.");
      if (!canUseSound(sound, command.authorId)) throw forbidden("SOUND_NOT_REUSABLE", "This sound can't be used.");
    }
    const sensitiveLabels = await prepareAudienceSettingsForPublishing(context, command.authorId, { visibility: command.visibility, sensitiveLabels: command.sensitiveLabels });
    const mentionResult = await prepareMentionsForWrite(context, { surface: "post", authorId: command.authorId, text: command.text, entities: command.mentions });
    const now = context.clock.now();
    const actor = await resolveEventActor(context.directory, command.authorId);
    const created = await context.database.transaction(async (transaction) => {
      const post = await postRepository.create(transaction, {
        authorId: command.authorId,
        kind: command.kind,
        text: command.text,
        audience: command.audience,
        visibility: command.visibility,
        replyPolicy: command.replyPolicy ?? "everyone",
        authorSensitiveLabels: sensitiveLabels,
        sensitiveLabels,
        isAiGenerated: command.isAiGenerated,
        mentions: mentionResult.entities as unknown as Prisma.InputJsonValue,
        createdAt: now,
        ...(command.soundId === undefined ? {} : { soundId: command.soundId }),
        ...(command.kind === "story" ? { expiresAt: new Date(now.getTime() + storyLifetimeHours * 3_600_000) } : {}),
        ...(command.replyToComment === undefined ? {} : { replyToCommentId: command.replyToComment.commentId, replyToClipId: command.replyToComment.clipId, replyToCommenterId: command.replyToComment.commenterUserId }),
        ...(command.stickerLayout === undefined ? {} : { stickerLayout: command.stickerLayout as unknown as Prisma.InputJsonValue }),
        media: {
          create: media.map((item, position) => ({
            mediaId: item.id, position, type: item.type, url: item.url ?? null, posterUrl: item.posterUrl ?? null, hlsUrl: item.hlsUrl ?? null, status: item.url === undefined || item.url === null ? "processing" : "ready",
            width: item.width ?? null, height: item.height ?? null, durationSeconds: item.durationSeconds ?? null, blurhash: item.blurhash ?? null,
          })),
        },
      });
      if (command.soundId !== undefined) await soundRepository.incrementUsage(transaction, command.soundId, 1);
      const events: DomainEventInput[] = [{ eventType: socialEventTypes.postCreated, subject: post.id, occurredAt: now, data: { postId: post.id, authorId: post.authorId, kind: post.kind, audience: post.audience, visibility: post.visibility, replyPolicy: post.replyPolicy, sensitiveLabels: post.sensitiveLabels, isAiGenerated: post.isAiGenerated, text: post.text.slice(0, 2000), mediaIds: post.media.map((media) => media.mediaId) } }];
      for (const userId of mentionResult.userIdsToNotify) {
        events.push({ eventType: socialEventTypes.mentionCreated, subject: post.id, occurredAt: now, data: { recipientUserId: userId, mentionedUserId: userId, actor, authorId: command.authorId, surface: "post", postId: post.id, excerpt: buildExcerpt(command.text), url: `/post/${post.id}` } });
      }
      if (comment !== undefined) {
        events.push({ eventType: socialEventTypes.videoReplyCreated, subject: post.id, occurredAt: now, data: { recipientUserId: comment.authorId, actor, url: `/clips/${post.id}`, replyClipId: post.id, originalClipId: comment.postId, commentId: comment.id, authorId: command.authorId, commenterId: comment.authorId } });
      }
      await appendDomainEventsToOutbox(transaction, events);
      return post;
    });
    const withPreview = created.media.length === 0 && command.kind === "post" ? await attachLinkPreviewWithinBudget(context, created.id, created.text) : null;
    const [view] = await buildPostViews(context, command.authorId, [withPreview === null ? created : { ...created, linkPreview: withPreview as unknown as Prisma.JsonValue }]);
    return view as PostView;
  };
}
