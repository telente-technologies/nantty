import { ApiError } from "@/errors/api.error";
import type { CreateUploadSessionRequest, Media, MediaAsset, NewPostInput, Post } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface MockUploadSession {
  readonly request: CreateUploadSessionRequest;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: Set<number>;
  mediaId: string | null;
}

interface MockStoredMedia {
  readonly asset: MediaAsset;
  readonly readyAt: number;
}

const MOCK_CHUNK_SIZE_BYTES = 512 * 1024;
const MOCK_PROCESSING_DELAY_MS = 2_500;
const uploadSessionsById = new Map<string, MockUploadSession>();
const storedMediaById = new Map<string, MockStoredMedia>();

const nextMockId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const findUploadSessionOrThrow = (uploadId: string) => {
  const session = uploadSessionsById.get(uploadId);
  if (!session) throw new ApiError(404, "Upload session not found", "UPLOAD_NOT_FOUND");
  return session;
};

const currentMediaAsset = (mediaId: string): MediaAsset | null => {
  const stored = storedMediaById.get(mediaId);
  if (!stored) return null;
  return Date.now() >= stored.readyAt ? { ...stored.asset, status: "ready" } : stored.asset;
};

const convertMediaAssetToPostMedia = (asset: MediaAsset): Media => ({
  id: asset.id,
  type: asset.type,
  url: asset.variants[0]?.url ?? null,
  posterUrl: asset.posterUrl ?? null,
  hlsUrl: asset.hlsUrl ?? null,
  width: asset.width,
  height: asset.height,
  durationSeconds: asset.durationSeconds,
  status: asset.status,
  blurhash: asset.blurhash ?? null,
});

export const mediaMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/media/uploads", ({ body }) => {
    const request = body as CreateUploadSessionRequest;
    if (!request.mimeType.startsWith("image/") && !request.mimeType.startsWith("video/")) {
      throw new ApiError(415, "Unsupported media type", "UNSUPPORTED_MEDIA_TYPE");
    }
    const uploadId = nextMockId("up");
    const totalChunks = Math.max(1, Math.ceil(request.sizeBytes / MOCK_CHUNK_SIZE_BYTES));
    uploadSessionsById.set(uploadId, { request, chunkSizeBytes: MOCK_CHUNK_SIZE_BYTES, totalChunks, uploadedChunks: new Set(), mediaId: null });
    return { uploadId, chunkSizeBytes: MOCK_CHUNK_SIZE_BYTES, totalChunks, uploadedChunks: [] };
  }),
  createMockRoute("PUT", "/api/v1/media/uploads/:uploadId/chunks/:chunkIndex", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const chunkIndex = Number(params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new ApiError(400, "Chunk index out of range", "CHUNK_OUT_OF_RANGE");
    }
    session.uploadedChunks.add(chunkIndex);
    return { uploadedChunks: [...session.uploadedChunks].sort((a, b) => a - b) };
  }),
  createMockRoute("GET", "/api/v1/media/uploads/:uploadId", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const media = session.mediaId ? currentMediaAsset(session.mediaId) : null;
    return {
      status: media ? media.status : "uploading",
      uploadedChunks: [...session.uploadedChunks].sort((a, b) => a - b),
      ...(media ? { media } : {}),
    };
  }),
  createMockRoute("POST", "/api/v1/media/uploads/:uploadId/complete", ({ params }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    if (session.uploadedChunks.size < session.totalChunks) throw new ApiError(409, "Some chunks are missing", "CHUNKS_MISSING");
    if (!session.mediaId) {
      const mediaId = nextMockId("med");
      const isVideo = session.request.mimeType.startsWith("video/");
      storedMediaById.set(mediaId, {
        readyAt: Date.now() + MOCK_PROCESSING_DELAY_MS,
        asset: { id: mediaId, type: isVideo ? "video" : "image", status: "processing", width: 1080, height: 1350, variants: [] },
      });
      session.mediaId = mediaId;
    }
    return { mediaId: session.mediaId, status: "processing" };
  }),
  createMockRoute("GET", "/api/v1/media/:mediaId", ({ params }) => {
    const asset = currentMediaAsset(params.mediaId!);
    if (!asset) throw new ApiError(404, "Media not found", "MEDIA_NOT_FOUND");
    return asset;
  }),
  createMockRoute("POST", "/api/v1/posts", ({ body }) => {
    const input = body as NewPostInput;
    if (input.mediaIds.length > 10) throw new ApiError(422, "A post can have up to 10 photos or videos", "TOO_MANY_MEDIA");
    const media = input.mediaIds.map((mediaId) => {
      const asset = currentMediaAsset(mediaId);
      if (!asset) throw new ApiError(422, "One of the uploads could not be found", "MEDIA_NOT_FOUND");
      return convertMediaAssetToPostMedia(asset);
    });
    const post: Post = {
      id: nextMockId("p"),
      kind: "post",
      author: getSignedInMockUser(),
      createdAt: new Date().toISOString(),
      text: input.text,
      media,
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      liked: false,
      bookmarked: false,
      isFollowingAuthor: true,
      friendsLiked: null,
      products: [],
      sponsored: null,
    };
    return post;
  }),
];
