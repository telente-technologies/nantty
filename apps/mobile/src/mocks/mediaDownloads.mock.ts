import { ApiError } from "@/errors/api.error";
import type { DownloadSettings, Post, PostMediaDownload } from "@/types";

import { findMockClipsByIds } from "./clips.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { findPostIncludingSponsored } from "./posts.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MOCK_VIDEO_RENDER_MS = 4000;
const renderStartedAtByKey = new Map<string, number>();
let mockDownloadSettings: DownloadSettings = { allowDownloads: true };

const findDownloadablePost = (postId: string): Post | undefined => findPostIncludingSponsored(postId) ?? findMockClipsByIds([postId])[0];

export const buildMockPostMediaDownload = (post: Post, mediaId: string, now = Date.now()): PostMediaDownload => {
  const media = post.media.find((item) => item.id === mediaId);
  if (!media?.url) throw new ApiError(404, "That photo or video isn't part of this post.", "MEDIA_NOT_IN_POST");
  const isOwner = post.author.id === getSignedInMockUser().id;
  if (!isOwner && (post.viewerCanDownload === false || post.subscriberOnly)) throw new ApiError(403, "The creator has turned off downloads.", "DOWNLOADS_DISABLED");
  const extension = media.type === "video" ? "mp4" : "jpg";
  const ready: PostMediaDownload = {
    status: "ready", progress: 1, url: media.url, expiresAt: new Date(now + 300_000).toISOString(),
    fileName: `nantty-${post.author.username}-${mediaId.slice(0, 8)}.${extension}`, contentType: media.type === "video" ? "video/mp4" : "image/jpeg",
  };
  if (media.type !== "video") return ready;
  const key = `${post.id}:${mediaId}`;
  const startedAt = renderStartedAtByKey.get(key) ?? now;
  renderStartedAtByKey.set(key, startedAt);
  const progress = Math.min(1, (now - startedAt) / MOCK_VIDEO_RENDER_MS);
  return progress >= 1 ? ready : { status: "processing", progress: Math.max(0.02, Math.round(progress * 100) / 100), retryAfterMs: 800 };
};

export const mediaDownloadsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/posts/:postId/media/:mediaId/download", ({ params, isGuest }) => {
    if (isGuest) throw new ApiError(401, "Sign in to download.", "UNAUTHENTICATED");
    const post = findDownloadablePost(params.postId!);
    if (!post) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
    return buildMockPostMediaDownload(post, params.mediaId!);
  }),
  createMockRoute("GET", "/api/v1/me/download-settings", () => mockDownloadSettings),
  createMockRoute("PUT", "/api/v1/me/download-settings", ({ body }) => {
    mockDownloadSettings = { allowDownloads: (body as Partial<DownloadSettings> | undefined)?.allowDownloads !== false };
    return mockDownloadSettings;
  }),
];
