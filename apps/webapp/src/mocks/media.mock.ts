import { ApiError } from "@/errors/api.error";
import type { CreateUploadSessionRequest, Media, MediaAsset, NewPostInput, Post } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { findMutableSoundState } from "./soundCatalog.mock";
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
const MOCK_SINGLE_PUT_MAXIMUM_BYTES = 8 * 1024 * 1024;
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

const convertMediaAssetToPostMedia = (asset: MediaAsset & { readonly type: Media["type"] }): Media => ({
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
    const isSupportedMimeType = ["image/", "video/", "audio/"].some((prefix) => request.mimeType.startsWith(prefix));
    if (!isSupportedMimeType) {
      throw new ApiError(415, "Unsupported media type", "UNSUPPORTED_MEDIA_TYPE");
    }
    const uploadId = nextMockId("up");
    const mode = request.sizeBytes < MOCK_SINGLE_PUT_MAXIMUM_BYTES ? "single" : "multipart";
    const chunkSizeBytes = mode === "single" ? request.sizeBytes : MOCK_CHUNK_SIZE_BYTES;
    const totalChunks = mode === "single" ? 1 : Math.ceil(request.sizeBytes / MOCK_CHUNK_SIZE_BYTES);
    uploadSessionsById.set(uploadId, { request, chunkSizeBytes, totalChunks, uploadedChunks: new Set(), mediaId: null });
    return { uploadId, mode, partSizeBytes: chunkSizeBytes, partCount: totalChunks, chunkSizeBytes, totalChunks, uploadedChunks: [] };
  }),
  createMockRoute("POST", "/api/v1/media/uploads/:uploadId/chunks/urls", ({ params, body }) => {
    const session = findUploadSessionOrThrow(params.uploadId!);
    const { chunkIndexes } = body as { chunkIndexes: number[] };
    return {
      urls: chunkIndexes.map((chunkIndex) => ({
        chunkIndex,
        url: `https://mock-media.s3.amazonaws.com/${params.uploadId}/${chunkIndex}`,
        method: "PUT",
        expectedBytes: session.chunkSizeBytes,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      })),
    };
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
      const mediaType = session.request.mimeType.startsWith("video/") ? "video" : session.request.mimeType.startsWith("audio/") ? "audio" : "image";
      storedMediaById.set(mediaId, {
        readyAt: Date.now() + MOCK_PROCESSING_DELAY_MS,
        asset: { id: mediaId, type: mediaType, status: "processing", width: mediaType === "audio" ? 0 : 1080, height: mediaType === "audio" ? 0 : 1350, variants: [] },
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
      if (asset.type === "audio") throw new ApiError(422, "Audio can't be posted on its own", "UNSUPPORTED_POST_MEDIA");
      return convertMediaAssetToPostMedia({ ...asset, type: asset.type });
    });
    if (input.soundId) {
      const sound = findMutableSoundState(input.soundId);
      if (!sound) throw new ApiError(422, "That sound isn't available", "SOUND_NOT_FOUND");
      if (!sound.allowReuse || sound.status !== "available") throw new ApiError(422, "That sound can't be reused", "SOUND_REUSE_NOT_ALLOWED");
    }
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
