import { File, Paths, UploadType } from "expo-file-system";
import { Platform } from "react-native";

import { shouldUseMockForPath } from "@/config/api.config";
import { ApiError } from "@/errors/api.error";
import type { BatchChunkUploadUrls, ChunkUploadUrl, CompletedUpload, CreateUploadSessionRequest, ID, MediaAsset, UploadSession, UploadSessionStatus } from "@/types";

import { api } from "./apiClient.service";

const webBlobsByUri = new Map<string, Blob>();

async function readWebBlob(fileUri: string) {
  const cached = webBlobsByUri.get(fileUri);
  if (cached) return cached;
  const blob = await (await fetch(fileUri)).blob();
  webBlobsByUri.set(fileUri, blob);
  return blob;
}

export async function readChunkBytesFromLocalFile(fileUri: string, offsetBytes: number, lengthBytes: number): Promise<Uint8Array> {
  if (Platform.OS === "web") {
    const blob = await readWebBlob(fileUri);
    return new Uint8Array(await blob.slice(offsetBytes, offsetBytes + lengthBytes).arrayBuffer());
  }
  const handle = new File(fileUri).open();
  try {
    handle.offset = offsetBytes;
    return handle.readBytes(lengthBytes);
  } finally {
    handle.close();
  }
}

async function putChunkToObjectStorageOnce(
  url: string,
  chunkBytes: Uint8Array,
  onBytesSent: (bytesSent: number) => void,
): Promise<{ status: number; bodyText: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(url, { method: "PUT", body: chunkBytes as Uint8Array<ArrayBuffer> });
    onBytesSent(chunkBytes.byteLength);
    return { status: response.status, bodyText: await response.text() };
  }
  const temporaryChunkFile = new File(Paths.cache, `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`);
  temporaryChunkFile.create({ overwrite: true });
  temporaryChunkFile.write(chunkBytes);
  try {
    const result = await temporaryChunkFile.upload(url, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      sessionType: "background",
      onProgress: ({ bytesSent }) => onBytesSent(bytesSent),
    });
    return { status: result.status, bodyText: result.body };
  } finally {
    if (temporaryChunkFile.exists) temporaryChunkFile.delete();
  }
}

export const mediaUploadTransport = {
  createUploadSession: (request: CreateUploadSessionRequest) => api.post<UploadSession>("/api/v1/media/uploads", request),
  fetchUploadSessionStatus: (uploadId: ID) => api.get<UploadSessionStatus>(`/api/v1/media/uploads/${uploadId}`),
  completeUploadSession: (uploadId: ID) => api.post<CompletedUpload>(`/api/v1/media/uploads/${uploadId}/complete`),
  fetchMediaAsset: (mediaId: ID) => api.get<MediaAsset>(`/api/v1/media/${mediaId}`),
  abortUploadSession: (uploadId: ID) => api.delete<void>(`/api/v1/media/uploads/${uploadId}`),
  fetchChunkUploadUrl: (uploadId: ID, chunkIndex: number) =>
    api.get<ChunkUploadUrl>(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}/url`),
  fetchChunkUploadUrls: (uploadId: ID, chunkIndexes: readonly number[]) =>
    api.post<BatchChunkUploadUrls>(`/api/v1/media/uploads/${uploadId}/chunks/urls`, { chunkIndexes }),
  uploadChunk: async (
    uploadId: ID,
    chunkIndex: number,
    chunkBytes: Uint8Array,
    onBytesSent: (bytesSent: number) => void,
    presignedTarget?: ChunkUploadUrl,
  ) => {
    const target = presignedTarget ?? (await mediaUploadTransport.fetchChunkUploadUrl(uploadId, chunkIndex));
    if (shouldUseMockForPath(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}/url`)) {
      await api.put(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}`, { byteLength: chunkBytes.byteLength });
      onBytesSent(chunkBytes.byteLength);
      return;
    }
    const response = await putChunkToObjectStorageOnce(target.url, chunkBytes, onBytesSent);
    if (response.status < 200 || response.status >= 300) throw new ApiError(response.status, "Upload failed", "CHUNK_UPLOAD_FAILED");
  },
};
