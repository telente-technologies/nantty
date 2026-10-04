import { ApiError } from "@/errors/api.error";
import type { CreateUploadSessionRequest, Media, MediaAsset, NewPostInput, Post } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { appendMockClip, findMockClipsByIds } from "./clips.mock";
import { buildClipMediaFromInput, validatePostLocation } from "./clipCreate.mock";
import { recordTagNotifications, sanitizeTaggedUserIds } from "./postTags.mock";
import { findCommentAnywhere, registerMockVideoReply } from "./comments.mock";
import { currentSoundForClip, findMutableSoundState } from "./soundCatalog.mock";
import { notifyMentionedUsers, sanitizeMentionsForWrite, userIdsWhoBlockedTheAuthor } from "./mentionRules.mock";
import { recordVideoReplyNotification } from "./mentionNotifications.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface MockUploadSession {
  readonly request: CreateUploadSessionRequest;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: Set<number>;
  mediaId: string | null;
  readonly reservedMediaId: string;
}

interface MockStoredMedia {
  readonly asset: MediaAsset;
  readonly readyAt: number;
}

const MOCK_CHUNK_SIZE_BYTES = 512 * 1024;
const MOCK_SINGLE_PUT_MAXIMUM_BYTES = 8 * 1024 * 1024;

const mockMediaTypeForMimeType = (mimeType: string): MediaAsset["type"] =>
  mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("image/") ? "image" : "document";

const buildProcessingAsset = (mediaId: string, mediaType: MediaAsset["type"]): MediaAsset => {
  const hasNoPixels = mediaType === "audio" || mediaType === "document";
  return {
    id: mediaId,
    type: mediaType,
    status: "processing",
    width: hasNoPixels ? 0 : 1080,
    height: hasNoPixels ? 0 : 1350,
    ...(hasNoPixels ? {} : { blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }),
    variants: [],
  };
};
const MOCK_PROCESSING_DELAY_MS = 2_500;
const uploadSessionsById = new Map<string, MockUploadSession>();
const storedMediaById = new Map<string, MockStoredMedia>();

const nextMockId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const findUploadSessionOrThrow = (uploadId: string) => {
  const session = uploadSessionsById.get(uploadId);
  if (!session) throw new ApiError(404, "Upload session not found", "UPLOAD_NOT_FOUND");
  return session;
};

const currentMediaAsset = (mediaId: string): MediaAsset | null => {
  const stored = storedMediaById.get(mediaId);
  if (!stored) return null;
  return Date.now() >= stored.readyAt ? { ...stored.asset, status: "ready" } : stored.asset;
};

const convertMediaAssetToPostMedia = (asset: MediaAsset & { readonly type: Media["type"] }): Media => ({
  id: asset.id,
  type: asset.type,
  url: asset.variants[0]?.url ?? null,
  posterUrl: asset.posterUrl ?? null,
  hlsUrl: asset.hlsUrl ?? null,
  width: asset.width,
  height: asset.height,
  durationSeconds: asset.durationSeconds,
  status: asset.status,
  blurhash: asset.blurhash ?? null,
});

export const mediaMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/media/uploads", ({ body }) => {
    const request = body as CreateUploadSessionRequest;
    const isSupportedMimeType = ["image/", "video/", "audio/", "application/pdf"].some((prefix) => request.mimeType.startsWith(prefix));
    if (!isSupportedMimeType) {
      throw new ApiError(415, "Unsupported media type", "UNSUPPORTED_MEDIA_TYPE");
    }
    const uploadId = nextMockId("up");
    const mediaId = nextMockId("med");
    const mode = request.sizeBytes < MOCK_SINGLE_PUT_MAXIMUM_BYTES ? "single" : "multipart";
    const chunkSizeBytes = mode === "single" ? request.sizeBytes : MOCK_CHUNK_SIZE_BYTES;
    const totalChunks = mode === "single" ? 1 : Math.ceil(request.sizeBytes / MOCK_CHUNK_SIZE_BYTES);
    uploadSessionsById.set(uploadId, { request, chunkSizeBytes, totalChunks, uploadedChunks: new Set(), mediaId: null, reservedMediaId: mediaId });
    const mediaType = mockMediaTypeForMimeType(request.mimeType);
    storedMediaById.set(mediaId, { readyAt: Number.POSITIVE_INFINITY, asset: buildProcessingAsset(mediaId, mediaType) });
    return { uploadId, mediaId, mode, partSizeBytes: chunkSizeBytes, partCount: totalChunks, chunkSizeBytes, totalChunks, uploadedChunks: [] };
  }),
  createMockRoute("GET", "/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const chunkIndex = Number(params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new ApiError(400, "Chunk index out of range", "CHUNK_OUT_OF_RANGE");
    }
    return {
      url: `https://mock-media.s3.amazonaws.com/${params.uploadId}/${chunkIndex}`,
      method: "PUT",
      expectedBytes: session.chunkSizeBytes,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }),
  createMockRoute("POST", "/api/v1/media/uploads/:uploadId/chunks/urls", ({ params, body }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const { chunkIndexes } = body as { chunkIndexes: number[] };
    return {
      urls: chunkIndexes.map((chunkIndex) => ({
        chunkIndex,
        url: `https://mock-media.s3.amazonaws.com/${params.uploadId}/${chunkIndex}`,
        method: "PUT",
        expectedBytes: session.chunkSizeBytes,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      })),
    };
  }),
  createMockRoute("DELETE", "/api/v1/media/uploads/:uploadId", ({ params }) => {
    uploadSessionsById.delete(params.uploadId!);
    return undefined;
  }),
  createMockRoute("PUT", "/api/v1/media/uploads/:uploadId/chunks/:chunkIndex", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const chunkIndex = Number(params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new ApiError(400, "Chunk index out of range", "CHUNK_OUT_OF_RANGE");
    }
    session.uploadedChunks.add(chunkIndex);
    return { uploadedChunks: [...session.uploadedChunks].sort((a, b) => a - b) };
  }),
  createMockRoute("GET", "/api/v1/media/uploads/:uploadId", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const media = session.mediaId ? currentMediaAsset(session.mediaId) : null;
    return {
      status: media ? media.status : "uploading",
      uploadedChunks: [...session.uploadedChunks].sort((a, b) => a - b),
      ...(media ? { media } : {}),
    };
  }),
  createMockRoute("POST", "/api/v1/media/uploads/:uploadId/complete", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    if (session.uploadedChunks.size < session.totalChunks) throw new ApiError(409, "Some chunks are missing", "CHUNKS_MISSING");
    if (!session.mediaId) {
      const mediaId = session.reservedMediaId;
      storedMediaById.set(mediaId, { readyAt: Date.now() + MOCK_PROCESSING_DELAY_MS, asset: buildProcessingAsset(mediaId, mockMediaTypeForMimeType(session.request.mimeType)) });
      session.mediaId = mediaId;
    }
    return { mediaId: session.mediaId, status: "processing" };
  }),
  createMockRoute("GET", "/api/v1/media/:mediaId", ({ params }) => {
    const asset = currentMediaAsset(params.mediaId!);
    if (!asset) throw new ApiError(404, "Media not found", "MEDIA_NOT_FOUND");
    return asset;
  }),
  createMockRoute("POST", "/api/v1/posts", ({ body }) => {
    const input = body as NewPostInput;
    if (input.mediaIds.length > 10) throw new ApiError(422, "A post can have up to 10 photos or videos", "TOO_MANY_MEDIA");
    const uploadedMedia = input.mediaIds.map((mediaId) => {
      const asset = currentMediaAsset(mediaId);
      if (!asset) throw new ApiError(422, "One of the uploads could not be found", "MEDIA_NOT_FOUND");
      if (asset.type === "audio" || asset.type === "document") throw new ApiError(422, "Audio can't be posted on its own", "UNSUPPORTED_POST_MEDIA");
      return convertMediaAssetToPostMedia({ ...asset, type: asset.type });
    });
    if (input.slideshow && input.kind !== "clip") throw new ApiError(422, "Only clips can be photo slideshows.", "SLIDESHOW_NEEDS_CLIP");
    const media = input.kind === "clip" ? buildClipMediaFromInput(input, uploadedMedia, nextMockId("render")) : uploadedMedia;
    validatePostLocation(input);
    const taggedUserIds = sanitizeTaggedUserIds(getSignedInMockUser().id, input.taggedUserIds);
    const videoReplyTarget = input.replyToComment;
    if (videoReplyTarget) {
      if (input.kind !== "clip") throw new ApiError(422, "A video reply must be a clip.", "VIDEO_REPLY_NEEDS_CLIP");
      const originalClip = findMockClipsByIds([videoReplyTarget.clipId])[0];
      if (!originalClip || originalClip.author.id !== getSignedInMockUser().id) {
        throw new ApiError(403, "Only the clip's author can reply with a video.", "FORBIDDEN");
      }
      const targetComment = findCommentAnywhere(videoReplyTarget.commentId);
      if (!targetComment || targetComment.postId !== originalClip.id) throw new ApiError(404, "Comment not found", "COMMENT_NOT_FOUND");
      if (userIdsWhoBlockedTheAuthor.has(targetComment.author.id)) {
        throw new ApiError(403, "You can't reply to this comment with a video.", "VIDEO_REPLY_BLOCKED");
      }
    }
    if (input.soundId) {
      const sound = findMutableSoundState(input.soundId);
      if (!sound) throw new ApiError(422, "That sound isn't available", "SOUND_NOT_FOUND");
      if (!sound.allowReuse || sound.status !== "available") throw new ApiError(422, "That sound can't be reused", "SOUND_REUSE_NOT_ALLOWED");
    }
    const sanitizedMentions = sanitizeMentionsForWrite(getSignedInMockUser(), input.mentions, "post");
    const post: Post = {
      id: nextMockId("p"),
      kind: input.kind === "clip" ? "clip" : "post",
      author: getSignedInMockUser(),
      createdAt: new Date().toISOString(),
      text: input.text,
      media: [...media],
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      liked: false,
      bookmarked: false,
      saveCount: 0,
      isFollowingAuthor: true,
      friendsLiked: null,
      products: [],
      sponsored: null,
      isAiGenerated: input.isAiGenerated === true,
      ...(input.location ? { location: input.location } : {}),
      ...(sanitizedMentions.mentions.length ? { mentions: sanitizedMentions.mentions } : {}),
      ...(videoReplyTarget ? { replyToComment: videoReplyTarget } : {}),
      ...(videoReplyTarget && input.stickerLayout ? { stickerLayout: input.stickerLayout } : {}),
    };
    notifyMentionedUsers(post.author, sanitizedMentions, "post");
    if (taggedUserIds.length > 0) recordTagNotifications(post.author, post.id, post.kind, taggedUserIds);
    if (videoReplyTarget) {
      registerMockVideoReply(videoReplyTarget.commentId, { clipId: post.id, thumbnailUrl: media[0]?.posterUrl ?? null, createdAt: post.createdAt });
      recordVideoReplyNotification(post.author, videoReplyTarget.commenterUserId);
    }
    if (post.kind === "clip") {
      appendMockClip({ ...post, durationSeconds: media[0]?.durationSeconds ?? 15, sound: currentSoundForClip(post.id) });
    }
    return post;
  }),
];
