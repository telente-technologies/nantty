import * as Crypto from "expo-crypto";
import { File, Paths, UploadType } from "expo-file-system";
import { Platform } from "react-native";

import { apiConfig } from "@/config/api.config";
import { ApiError } from "@/errors/api.error";
import type { CompletedUpload, CreateUploadSessionRequest, ID, MediaAsset, UploadSession, UploadSessionStatus } from "@/types";

import { api, getAuthorizedRequestHeaders, refreshSessionAfterUnauthorizedResponse } from "./apiClient.service";

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

export async function calculateSha256HexOfBytes(bytes: Uint8Array) {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const parseUploadedChunksResponse = (bodyText: string): { uploadedChunks: number[] } => {
  const payload = JSON.parse(bodyText || "{}") as { data?: { uploadedChunks: number[] }; uploadedChunks?: number[] };
  return { uploadedChunks: payload.data?.uploadedChunks ?? payload.uploadedChunks ?? [] };
};

async function sendChunkBytesOverNetworkOnce(
  path: string,
  chunkBytes: Uint8Array,
  chunkSha256: string,
  onBytesSent: (bytesSent: number) => void,
): Promise<{ status: number; bodyText: string }> {
  const headers = { ...getAuthorizedRequestHeaders(), "Content-Type": "application/octet-stream", "X-Chunk-Sha256": chunkSha256 };
  const url = `${apiConfig.baseUrl}${path}`;
  if (Platform.OS === "web") {
    const response = await fetch(url, { method: "PUT", headers, body: chunkBytes as Uint8Array<ArrayBuffer> });
    onBytesSent(chunkBytes.byteLength);
    return { status: response.status, bodyText: await response.text() };
  }
  const temporaryChunkFile = new File(Paths.cache, `chunk-${chunkSha256.slice(0, 16)}-${Date.now()}.bin`);
  temporaryChunkFile.create({ overwrite: true });
  temporaryChunkFile.write(chunkBytes);
  try {
    const result = await temporaryChunkFile.upload(url, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: "application/octet-stream",
      headers,
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
  uploadChunk: async (
    uploadId: ID,
    chunkIndex: number,
    chunkBytes: Uint8Array,
    onBytesSent: (bytesSent: number) => void,
  ): Promise<{ uploadedChunks: number[] }> => {
    const path = `/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}`;
    const chunkSha256 = await calculateSha256HexOfBytes(chunkBytes);
    if (apiConfig.useMocks) {
      const result = await api.put<{ uploadedChunks: number[] }>(path, { byteLength: chunkBytes.byteLength, chunkSha256 });
      onBytesSent(chunkBytes.byteLength);
      return result;
    }
    let response = await sendChunkBytesOverNetworkOnce(path, chunkBytes, chunkSha256, onBytesSent);
    if (response.status === 401 && (await refreshSessionAfterUnauthorizedResponse())) {
      response = await sendChunkBytesOverNetworkOnce(path, chunkBytes, chunkSha256, onBytesSent);
    }
    if (response.status < 200 || response.status >= 300) {
      const error = (() => {
        try {
          return JSON.parse(response.bodyText) as { message?: string; code?: string };
        } catch {
          return {};
        }
      })();
      throw new ApiError(response.status, error.message ?? "Upload failed", error.code);
    }
    return parseUploadedChunksResponse(response.bodyText);
  },
};
