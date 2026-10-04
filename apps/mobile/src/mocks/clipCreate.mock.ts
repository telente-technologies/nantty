import { ApiError } from "@/errors/api.error";
import type { Media, NewPostInput } from "@/types";

const CLIP_MAXIMUM_MS = 180_000;
const PHOTO_MINIMUM_MS = 1_000;
const PHOTO_MAXIMUM_MS = 10_000;
const TRANSITIONS = ["none", "crossfade", "slide"];

export const validatePostLocation = (input: NewPostInput) => {
  const location = input.location;
  if (!location) return;
  if (typeof location.placeId !== "string" || !location.placeId || typeof location.name !== "string" || !location.name.trim() || location.name.length > 80) {
    throw new ApiError(422, "That location can't be used", "INVALID_LOCATION");
  }
};

export const buildClipMediaFromInput = (input: NewPostInput, media: readonly Media[], renderJobId: string): readonly Media[] => {
  if (input.slideshow) {
    const { durationsMs, transition } = input.slideshow;
    if (media.length === 0 || media.length > 10 || media.some((item) => item.type !== "image")) throw new ApiError(422, "A photo clip needs 1 to 10 photos.", "CLIP_SLIDESHOW_NEEDS_PHOTOS");
    if (durationsMs.length !== media.length || durationsMs.some((ms) => ms < PHOTO_MINIMUM_MS || ms > PHOTO_MAXIMUM_MS)) throw new ApiError(422, "Each photo shows for 1 to 10 seconds.", "CLIP_SLIDESHOW_BAD_DURATION");
    if (!TRANSITIONS.includes(transition)) throw new ApiError(422, "That transition isn't supported.", "CLIP_SLIDESHOW_BAD_TRANSITION");
    const totalMs = durationsMs.reduce((sum, ms) => sum + ms, 0);
    if (totalMs > CLIP_MAXIMUM_MS) throw new ApiError(422, "Clips can be up to 3 minutes long.", "CLIP_TOO_LONG");
    return [{ id: renderJobId, type: "video", url: null, posterUrl: media[0]?.url ?? null, width: 1080, height: 1920, durationSeconds: totalMs / 1000, status: "processing" }];
  }
  if (media.length !== 1 || media[0]?.type !== "video") throw new ApiError(422, "A clip needs exactly one video.", "CLIP_NEEDS_ONE_VIDEO");
  const trim = input.media?.[0]?.trim;
  if (!trim) return media;
  const durationMs = (media[0].durationSeconds ?? CLIP_MAXIMUM_MS / 1000) * 1000;
  if (trim.startMs < 0 || trim.endMs <= trim.startMs || trim.endMs > durationMs || trim.endMs - trim.startMs > CLIP_MAXIMUM_MS) throw new ApiError(422, "That trim doesn't fit the video.", "CLIP_BAD_TRIM");
  return [{ ...media[0], durationSeconds: (trim.endMs - trim.startMs) / 1000, status: "processing" }];
};
