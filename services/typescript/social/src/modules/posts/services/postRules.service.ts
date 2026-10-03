import { maximumClipDurationSeconds, maximumMediaPerPost } from "../../../constants/social.constant.js";
import { unprocessable } from "../../../errors/social.error.js";

export interface MediaDescriptor {
  readonly id: string;
  readonly type: "image" | "video";
  readonly durationSeconds?: number | undefined;
  readonly status?: "uploaded" | "processing" | "ready" | "failed" | undefined;
}

export type PostKindInput = "post" | "clip" | "story";

export function assertMediaFitsPostKind(kind: PostKindInput, text: string, media: readonly MediaDescriptor[]): void {
  if (media.length > maximumMediaPerPost) throw unprocessable("TOO_MANY_MEDIA", `A post can have up to ${maximumMediaPerPost} media items.`);
  if (media.some((item) => item.status === "failed")) throw unprocessable("MEDIA_FAILED", "One of the uploads failed. Remove it and try again.");
  if (kind === "clip") {
    if (media.length !== 1 || media[0]?.type !== "video") throw unprocessable("CLIP_REQUIRES_ONE_VIDEO", "A clip needs exactly one video.");
    const duration = media[0].durationSeconds;
    if (duration !== undefined && duration > maximumClipDurationSeconds) throw unprocessable("CLIP_TOO_LONG", `Clips can be up to ${maximumClipDurationSeconds} seconds.`);
  }
  if (kind === "story" && media.length !== 1) throw unprocessable("STORY_REQUIRES_ONE_MEDIA", "A story needs exactly one photo or video.");
  if (kind === "post" && media.length === 0 && text.trim() === "") throw unprocessable("POST_EMPTY", "Write something or add media.");
}

export function isSavedItemTypeForPost(kind: "post" | "clip" | "story", media: readonly { readonly type: string }[]): "post" | "video" | "clip" {
  if (kind === "clip") return "clip";
  return media.some((item) => item.type === "video") ? "video" : "post";
}

export function canViewerSeePostByAudience(input: { readonly audience: "everyone" | "followers"; readonly viewerId: string | undefined; readonly authorId: string; readonly viewerFollowsAuthor: boolean }): boolean {
  if (input.viewerId === input.authorId) return true;
  return input.audience === "everyone" || input.viewerFollowsAuthor;
}
