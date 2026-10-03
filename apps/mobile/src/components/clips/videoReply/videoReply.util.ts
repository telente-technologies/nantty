import type { CommentStickerLayout, Comment, Clip, PostAudience, ReplyToComment } from "@/types";

export const STICKER_TEXT_LIMIT = 150;
export const STICKER_MIN_SCALE = 0.5;
export const STICKER_MAX_SCALE = 2.5;
export const STICKER_REFERENCE_WIDTH = 320;
export const DEFAULT_STICKER_LAYOUT: CommentStickerLayout = { x: 0.5, y: 0.2, scale: 1, rotation: 0 };

export interface VideoReplyTarget extends ReplyToComment {
  readonly commenterUsername: string;
  readonly commenterAvatarUrl: string | null;
  readonly text: string;
  readonly originalAudience: PostAudience | "subscribers";
}

export const truncateStickerText = (text: string) =>
  text.length <= STICKER_TEXT_LIMIT ? text : `${text.slice(0, STICKER_TEXT_LIMIT - 1).trimEnd()}…`;

export const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampStickerLayout = (layout: CommentStickerLayout): CommentStickerLayout => ({
  ...layout,
  x: clampNumber(layout.x, 0.05, 0.95),
  y: clampNumber(layout.y, 0.05, 0.95),
  scale: clampNumber(layout.scale, STICKER_MIN_SCALE, STICKER_MAX_SCALE),
});

export const canReplyWithVideo = (comment: Comment, clipAuthorId: string | null | undefined, signedInUserId: string | null) =>
  !!signedInUserId && !!clipAuthorId && signedInUserId === clipAuthorId && !comment.id.startsWith("pending_") && !comment.videoReplyBlocked;

export const buildVideoReplyTarget = (comment: Comment, clip: Pick<Clip, "id" | "subscriberOnly">): VideoReplyTarget => ({
  commentId: comment.id,
  clipId: clip.id,
  commenterUserId: comment.author.id,
  commenterUsername: comment.author.username,
  commenterAvatarUrl: comment.author.avatarUrl ?? null,
  text: comment.text,
  originalAudience: clip.subscriberOnly ? "subscribers" : "everyone",
});

export const isAudienceBroaderThanOriginal = (audience: PostAudience, original: VideoReplyTarget["originalAudience"]) =>
  audience === "everyone" && original !== "everyone";
