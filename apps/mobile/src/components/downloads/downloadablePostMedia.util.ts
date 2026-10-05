import type { DownloadableMedia, Media, Post } from "@/types";

export const isDownloadableMedia = (media: Media | undefined): media is DownloadableMedia =>
  !!media?.id && (media.status === undefined || media.status === "ready") && (media.type === "image" || media.type === "video");

export const canOfferDownloadForPost = (post: Pick<Post, "media" | "sponsored" | "viewerCanDownload">) =>
  !post.sponsored && post.viewerCanDownload !== false && post.media.some(isDownloadableMedia);

export const findFirstDownloadableMedia = (post: Pick<Post, "media">) => post.media.find(isDownloadableMedia);
