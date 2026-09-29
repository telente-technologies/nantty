import type { VideoSource } from "expo-video";

import type { Media } from "@/types";

const isHlsPlaylistUrl = (url: string) => /\.m3u8(\?|$)/i.test(url);
const isRemoteHttpUrl = (url: string) => /^https?:\/\//i.test(url);

export const hasPlayableHlsStream = (media: Media) => !!media.hlsUrl;

export function buildCachedVideoSourceForMedia(media: Media, preferHlsStream: boolean): VideoSource {
  if (preferHlsStream && media.hlsUrl) return { uri: media.hlsUrl, contentType: "hls", useCaching: false };
  if (!media.url) return null;
  if (isHlsPlaylistUrl(media.url)) return { uri: media.url, contentType: "hls", useCaching: false };
  return { uri: media.url, contentType: "progressive", useCaching: isRemoteHttpUrl(media.url) };
}
