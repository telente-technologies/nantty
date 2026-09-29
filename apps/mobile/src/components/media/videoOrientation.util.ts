import type { Media } from "@/types";

export const isLandscapeMedia = (media: Media | undefined) =>
  !!media && !!media.width && !!media.height && media.width > media.height;

export const calculateFeedVideoAspectRatio = (media: Media) => (isLandscapeMedia(media) ? 16 / 9 : 4 / 5);
