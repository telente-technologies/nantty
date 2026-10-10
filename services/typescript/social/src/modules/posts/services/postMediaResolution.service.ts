import { SocialError, unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { CreatePostCommand, MediaReferenceInput } from "../commands/createPost/createPost.command.js";
import type { PostClipEdit } from "../models/post.model.js";
import { CLIP_LOOKS, type ClipLook } from "../models/post.model.js";

export async function resolveOwnedPostMedia(context: HandlerContext, authorId: string, mediaIds: readonly string[]): Promise<MediaReferenceInput[]> {
  const unique = [...new Set(mediaIds)];
  if (unique.length === 0) return [];
  if (context.media === undefined) throw new SocialError(503, "MEDIA_UNAVAILABLE", "Media is temporarily unavailable. Try again shortly.");
  const resolved = await context.media.resolveOwnedMedia(authorId, unique);
  const missing = unique.filter((mediaId) => !resolved.has(mediaId));
  if (missing.length > 0) throw unprocessable("MEDIA_NOT_FOUND", "Upload the media first. You can only post media you uploaded.", { mediaIds: missing });
  return unique.map((mediaId) => resolved.get(mediaId) as MediaReferenceInput);
}

export function buildClipEdit(command: Pick<CreatePostCommand, "kind" | "mediaTrims" | "slideshow" | "look">, media: readonly MediaReferenceInput[]): PostClipEdit | null {
  const look = clipLookFor(command);
  if (command.kind !== "clip") return look === undefined ? null : { look };
  const trims = Object.fromEntries(Object.entries(command.mediaTrims ?? {}).filter(([mediaId]) => media.some((item) => item.id === mediaId && item.type === "video")));
  for (const trim of Object.values(trims)) if (trim.endMs <= trim.startMs) throw unprocessable("TRIM_INVALID", "A trim must end after it starts.");
  const slideshow = command.slideshow;
  if (slideshow !== undefined && slideshow.durationsMs.length !== media.filter((item) => item.type === "image").length) throw unprocessable("SLIDESHOW_INVALID", "Give one duration per slideshow image.");
  if (Object.keys(trims).length === 0 && slideshow === undefined && look === undefined) return null;
  return { ...(Object.keys(trims).length === 0 ? {} : { trims }), ...(slideshow === undefined ? {} : { slideshow }), ...(look === undefined ? {} : { look }) };
}

function clipLookFor(command: Pick<CreatePostCommand, "look">): ClipLook | undefined {
  if (command.look === undefined) return undefined;
  if (!(CLIP_LOOKS as readonly string[]).includes(command.look)) throw unprocessable("INVALID_LOOK", "That look isn't available.");
  return command.look as ClipLook;
}

export function clipDurationSeconds(media: readonly { readonly mediaId: string; readonly type: string; readonly durationSeconds: number | null }[], clipEdit: PostClipEdit | null): number | null {
  if (clipEdit?.slideshow !== undefined) return Math.round(clipEdit.slideshow.durationsMs.reduce((total, duration) => total + duration, 0) / 1000);
  const video = media.find((item) => item.type === "video");
  if (video === undefined) return null;
  const trim = clipEdit?.trims?.[video.mediaId];
  if (trim !== undefined) return Math.max(1, Math.round((trim.endMs - trim.startMs) / 1000));
  return video.durationSeconds;
}
