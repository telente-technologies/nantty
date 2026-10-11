import type { ClipMediaInput, ClipSlideshowInput, ClipTransition, ID } from "@/types";

export const CLIP_MAXIMUM_SECONDS = 180;
export const CLIP_MAXIMUM_PHOTOS = 10;
export const PHOTO_SECONDS_DEFAULT = 3;
export const PHOTO_SECONDS_MINIMUM = 1;
export const PHOTO_SECONDS_MAXIMUM = 10;
export const TRIM_MINIMUM_SECONDS = 1;
export const CLIP_LOOKS = ["none", "warm", "cool", "rose", "aqua", "sunset"] as const;
export type ClipLookId = (typeof CLIP_LOOKS)[number];
export const CLIP_LOOK_LABELS: Record<ClipLookId, string> = { none: "None", warm: "Warm", cool: "Cool", rose: "Rosé", aqua: "Aqua", sunset: "Sunset" };

export interface ClipDraftMedia {
  readonly localId: string;
  readonly mediaType: "image" | "video";
  readonly durationSeconds: number | null;
}

export interface ClipTrim {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface ClipEdits {
  readonly photoSeconds: Readonly<Record<string, number>>;
  readonly trim: ClipTrim | null;
  readonly transition: ClipTransition;
  readonly look: ClipLookId;
}

export const EMPTY_CLIP_EDITS: ClipEdits = { photoSeconds: {}, trim: null, transition: "crossfade", look: "none" };

export type ClipSource = "video" | "photos";

export const readClipSource = (items: readonly ClipDraftMedia[]): ClipSource | null => {
  if (items.length === 0) return null;
  return items.every((item) => item.mediaType === "image") ? "photos" : "video";
};

export const secondsForPhoto = (edits: ClipEdits, localId: string) => edits.photoSeconds[localId] ?? PHOTO_SECONDS_DEFAULT;
export const clampPhotoSeconds = (seconds: number) => Math.min(PHOTO_SECONDS_MAXIMUM, Math.max(PHOTO_SECONDS_MINIMUM, Math.round(seconds)));

export const defaultTrimFor = (durationSeconds: number | null): ClipTrim | null =>
  durationSeconds && durationSeconds > 0 ? { startSeconds: 0, endSeconds: Math.min(durationSeconds, CLIP_MAXIMUM_SECONDS) } : null;

export const clampTrim = (trim: ClipTrim, durationSeconds: number): ClipTrim => {
  const startSeconds = Math.max(0, Math.min(trim.startSeconds, durationSeconds - TRIM_MINIMUM_SECONDS));
  const latestEnd = Math.min(durationSeconds, startSeconds + CLIP_MAXIMUM_SECONDS);
  const endSeconds = Math.max(startSeconds + TRIM_MINIMUM_SECONDS, Math.min(trim.endSeconds, latestEnd));
  return { startSeconds, endSeconds };
};

export const totalClipSeconds = (items: readonly ClipDraftMedia[], edits: ClipEdits): number => {
  const source = readClipSource(items);
  if (source === "photos") return items.reduce((sum, item) => sum + secondsForPhoto(edits, item.localId), 0);
  if (source === "video") return edits.trim ? edits.trim.endSeconds - edits.trim.startSeconds : (items[0]?.durationSeconds ?? 0);
  return 0;
};

export const validateClipDraft = (items: readonly ClipDraftMedia[], edits: ClipEdits): string | null => {
  const source = readClipSource(items);
  if (!source) return "Add a video or photos to continue.";
  const videoCount = items.filter((item) => item.mediaType === "video").length;
  if (source === "video" && (videoCount !== 1 || items.length !== 1)) return "A clip uses one video or a set of photos, not both.";
  if (source === "photos" && items.length > CLIP_MAXIMUM_PHOTOS) return `A photo clip can have up to ${CLIP_MAXIMUM_PHOTOS} photos.`;
  if (totalClipSeconds(items, edits) > CLIP_MAXIMUM_SECONDS) return "Clips can be up to 3 minutes long.";
  return null;
};

export const formatClipSeconds = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export interface ClipCreateFields {
  readonly media?: readonly ClipMediaInput[];
  readonly slideshow?: ClipSlideshowInput;
}

export const buildClipCreateFields = (items: readonly ClipDraftMedia[], mediaIds: readonly ID[], edits: ClipEdits): ClipCreateFields => {
  if (readClipSource(items) === "photos") {
    return { slideshow: { durationsMs: items.map((item) => secondsForPhoto(edits, item.localId) * 1000), transition: edits.transition } };
  }
  const duration = items[0]?.durationSeconds ?? null;
  const trim = edits.trim && duration ? clampTrim(edits.trim, duration) : null;
  const isTrimmed = !!trim && duration !== null && (trim.startSeconds > 0 || trim.endSeconds < duration);
  return {
    media: mediaIds.slice(0, 1).map((mediaId) => ({
      mediaId,
      type: "video" as const,
      ...(isTrimmed && trim ? { trim: { startMs: Math.round(trim.startSeconds * 1000), endMs: Math.round(trim.endSeconds * 1000) } } : {}),
    })),
  };
};
