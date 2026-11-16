import assert from "node:assert/strict";
import test from "node:test";

import { uploadMediaBytes, type MediaUploadRequest } from "./messengerMediaUpload.service";
import type { MessengerRequest } from "./messengerChat.service";

const metadata: MediaUploadRequest = { fileName: "story.jpg", mimeType: "image/jpeg", purpose: "story" };

test("uploads one part and completes against the existing media contract", async () => {
  const calls: { path: string; method: string }[] = [];
  const request: MessengerRequest = async <T,>(path, options) => {
    calls.push({ path, method: options?.method ?? "GET" });
    if (path === "/api/v1/media/uploads") return { uploadId: "upload-1", mode: "single", url: "https://upload.example/put", chunkSizeBytes: 0, totalChunks: 0, uploadedChunks: [] } as T;
    if (path.endsWith("/complete")) return { mediaId: "media-1" } as T;
    throw new Error(`unexpected request ${path}`);
  };
  let uploaded: Uint8Array | undefined;
  const mediaId = await uploadMediaBytes(request, metadata, new Uint8Array([1, 2, 3]), async (_url, bytes) => { uploaded = bytes; });
  assert.equal(mediaId, "media-1");
  assert.deepEqual([...(uploaded ?? [])], [1, 2, 3]);
  assert.deepEqual(calls, [
    { path: "/api/v1/media/uploads", method: "POST" },
    { path: "/api/v1/media/uploads/upload-1/complete", method: "POST" },
  ]);
});

test("uploads only missing multipart chunks and aborts failed sessions", async () => {
  const calls: string[] = [];
  const request: MessengerRequest = async <T,>(path, options) => {
    calls.push(`${options?.method ?? "GET"} ${path}`);
    if (path === "/api/v1/media/uploads") return { uploadId: "upload/2", mode: "multipart", chunkSizeBytes: 2, totalChunks: 2, uploadedChunks: [0] } as T;
    if (path.endsWith("/chunks/1/url")) return { url: "https://upload.example/chunk" } as T;
    throw new Error("complete should not run after an upload failure");
  };
  await assert.rejects(uploadMediaBytes(request, metadata, new Uint8Array([1, 2, 3]), async (_url, chunk) => {
    assert.deepEqual([...chunk], [3]);
    throw new Error("network unavailable");
  }), /network unavailable/);
  assert.deepEqual(calls, [
    "POST /api/v1/media/uploads",
    "GET /api/v1/media/uploads/upload%2F2/chunks/1/url",
    "DELETE /api/v1/media/uploads/upload%2F2",
  ]);
});

test("rejects an inconsistent server chunk plan and aborts the upload", async () => {
  const calls: string[] = [];
  const request: MessengerRequest = async <T,>(path, options) => {
    calls.push(`${options?.method ?? "GET"} ${path}`);
    if (path === "/api/v1/media/uploads") return { uploadId: "upload-3", mode: "multipart", chunkSizeBytes: 2, totalChunks: 3, uploadedChunks: [] } as T;
    return undefined as T;
  };
  await assert.rejects(uploadMediaBytes(request, metadata, new Uint8Array([1, 2, 3]), async () => assert.fail("invalid chunk plan must not upload")), /incomplete chunk layout/);
  assert.deepEqual(calls, ["POST /api/v1/media/uploads", "DELETE /api/v1/media/uploads/upload-3"]);
});

test("rejects an invalid uploaded chunk index and aborts the session", async () => {
  const calls: string[] = [];
  const request: MessengerRequest = async <T,>(path, options) => {
    calls.push(`${options?.method ?? "GET"} ${path}`);
    if (path === "/api/v1/media/uploads") return { uploadId: "upload-4", mode: "multipart", chunkSizeBytes: 2, totalChunks: 2, uploadedChunks: [2] } as T;
    return undefined as T;
  };
  await assert.rejects(uploadMediaBytes(request, metadata, new Uint8Array([1, 2, 3]), async () => assert.fail("invalid uploaded chunk must not upload")), /invalid chunk state/);
  assert.deepEqual(calls, ["POST /api/v1/media/uploads", "DELETE /api/v1/media/uploads/upload-4"]);
});
