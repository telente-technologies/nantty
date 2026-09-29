import { Image } from "expo-image";

import type { Clip } from "@/types";

const posterUrlsAlreadyPrefetched = new Set<string>();

export function prefetchUpcomingClipPosters(clips: readonly Clip[], activeClipIndex: number, numberOfUpcomingClips: number) {
  const upcomingPosterUrls = clips
    .slice(activeClipIndex + 1, activeClipIndex + 1 + numberOfUpcomingClips)
    .flatMap((clip) => clip.media.map((media) => media.posterUrl ?? null))
    .filter((url): url is string => !!url && !posterUrlsAlreadyPrefetched.has(url));
  if (upcomingPosterUrls.length === 0) return;
  upcomingPosterUrls.forEach((url) => posterUrlsAlreadyPrefetched.add(url));
  Image.prefetch(upcomingPosterUrls, "memory-disk").catch(() => undefined);
}
