import { afterAll, describe, expect, it } from "vitest";

import { buildPngBytes, createMediaTestApplication, sha256Hex, TEST_CHUNK_SIZE } from "./mediaSetup.fixture.js";

const app = createMediaTestApplication();
afterAll(async () => {
  await app.processingQueue.close();
  await app.close();
});

describe("chunked media uploads", () => {
  it("plans chunks from the file size and validates type, purpose and size", async () => {
    const user = await app.registerUser();
    const small = await app.startUpload(user.accessToken, buildPngBytes(300));
    expect(small).toEqual({ uploadId: expect.any(String), chunkSizeBytes: 300, totalChunks: 1, uploadedChunks: [] });
    const large = await app.startUpload(user.accessToken, buildPngBytes(TEST_CHUNK_SIZE * 2 + 5));
    expect(large).toMatchObject({ chunkSizeBytes: TEST_CHUNK_SIZE, totalChunks: 3 });

    const upload = (body: Record<string, unknown>) => app.client.post("/api/v1/media/uploads").auth(user.accessToken).send({ fileName: "a", sizeBytes: 10, ...body });
    await upload({ mimeType: "text/html", purpose: "post" }).expect(400);
    await upload({ mimeType: "video/mp4", purpose: "avatar" }).expect(422);
    await upload({ mimeType: "application/pdf", purpose: "post" }).expect(422);
    await upload({ mimeType: "application/pdf", purpose: "kyc" }).expect(201);
    await upload({ mimeType: "audio/ogg", purpose: "voice" }).expect(201);
    await upload({ mimeType: "image/png", purpose: "avatar", sizeBytes: 600 * 1024 }).expect(422);
    await app.client.post("/api/v1/media/uploads").send({ fileName: "a", sizeBytes: 10, mimeType: "image/png", purpose: "post" }).expect(401);
  });

  it("verifies chunk hashes and lengths, is idempotent and refuses a different payload", async () => {
    const user = await app.registerUser();
    const bytes = buildPngBytes(TEST_CHUNK_SIZE + 100);
    const upload = await app.startUpload(user.accessToken, bytes);
    const firstChunk = app.sliceChunk(bytes, 0);

    await app.sendChunk(user.accessToken, upload.uploadId, 0, firstChunk, "0".repeat(64)).expect(422);
    await app.sendChunk(user.accessToken, upload.uploadId, 0, firstChunk, "not-a-hash").expect(400);
    await app.sendChunk(user.accessToken, upload.uploadId, 0, firstChunk.subarray(0, 500)).expect(422);
    await app.sendChunk(user.accessToken, upload.uploadId, 1, bytes.subarray(TEST_CHUNK_SIZE, TEST_CHUNK_SIZE + 99)).expect(422);
    await app.sendChunk(user.accessToken, upload.uploadId, 2, app.sliceChunk(bytes, 1)).expect(422);
    await app.client
      .put(`/api/v1/media/uploads/${upload.uploadId}/chunks/0`)
      .auth(user.accessToken)
      .set("content-type", "text/plain")
      .set("x-chunk-sha256", sha256Hex(firstChunk))
      .send(firstChunk)
      .expect(415);

    const stored = await app.sendChunk(user.accessToken, upload.uploadId, 0, firstChunk).expect(200);
    expect(stored.json()).toEqual({ uploadedChunks: [0] });
    const repeated = await app.sendChunk(user.accessToken, upload.uploadId, 0, firstChunk).expect(200);
    expect(repeated.json()).toEqual({ uploadedChunks: [0] });

    const different = new Uint8Array(firstChunk);
    different[100] = (different[100] ?? 0) ^ 0xff;
    await app.sendChunk(user.accessToken, upload.uploadId, 0, different).expect(409);
  });

  it("resumes: progress lists stored chunks and completion waits for every chunk", async () => {
    const user = await app.registerUser();
    const bytes = buildPngBytes(TEST_CHUNK_SIZE * 2 + 10);
    const upload = await app.startUpload(user.accessToken, bytes, { sha256: sha256Hex(bytes) });
    await app.sendChunk(user.accessToken, upload.uploadId, 2, app.sliceChunk(bytes, 2)).expect(200);
    await app.sendChunk(user.accessToken, upload.uploadId, 0, app.sliceChunk(bytes, 0)).expect(200);

    const progress = await app.client.get(`/api/v1/media/uploads/${upload.uploadId}`).auth(user.accessToken).expect(200);
    expect(progress.json()).toEqual({ status: "uploading", uploadedChunks: [0, 2] });
    await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(user.accessToken).expect(409);

    await app.sendChunk(user.accessToken, upload.uploadId, 1, app.sliceChunk(bytes, 1)).expect(200);
    const completed = await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(user.accessToken).expect(202);
    expect(completed.json()).toEqual({ mediaId: expect.any(String), status: "processing" });
    await app.sendChunk(user.accessToken, upload.uploadId, 1, app.sliceChunk(bytes, 1)).expect(409);
    const again = await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(user.accessToken).expect(202);
    expect(again.json<{ mediaId: string }>().mediaId).toBe(completed.json<{ mediaId: string }>().mediaId);
    expect(app.blobs.listKeys(`private/uploads/${upload.uploadId}/`)).toEqual([]);
    await app.processingQueue.waitUntilIdle();
  });

  it("hides uploads from other users", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    const bytes = buildPngBytes(200);
    const upload = await app.startUpload(owner.accessToken, bytes);
    await app.sendChunk(stranger.accessToken, upload.uploadId, 0, bytes).expect(404);
    await app.client.get(`/api/v1/media/uploads/${upload.uploadId}`).auth(stranger.accessToken).expect(404);
    await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(stranger.accessToken).expect(404);
  });

  it("rejects content whose magic bytes do not match the declared type", async () => {
    const user = await app.registerUser();
    const bytes = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const upload = await app.startUpload(user.accessToken, bytes, { mimeType: "image/jpeg" });
    await app.sendChunk(user.accessToken, upload.uploadId, 0, bytes).expect(200);
    await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(user.accessToken).expect(422);
    const progress = await app.client.get(`/api/v1/media/uploads/${upload.uploadId}`).auth(user.accessToken).expect(200);
    expect(progress.json()).toMatchObject({ status: "failed", failureReason: expect.stringContaining("image/jpeg") });
  });

  it("rejects an assembled file that does not match the declared sha256", async () => {
    const user = await app.registerUser();
    const bytes = buildPngBytes(300);
    const upload = await app.startUpload(user.accessToken, bytes, { sha256: "a".repeat(64) });
    await app.sendChunk(user.accessToken, upload.uploadId, 0, bytes).expect(200);
    const originalsBefore = app.blobs.listKeys("private/originals/").length;
    await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(user.accessToken).expect(422);
    expect(app.blobs.listKeys("private/originals/")).toHaveLength(originalsBefore);
  });

  it("deletes abandoned uploads with the scheduled cleanup job", async () => {
    const user = await app.registerUser();
    const bytes = buildPngBytes(TEST_CHUNK_SIZE + 1);
    const upload = await app.startUpload(user.accessToken, bytes);
    await app.sendChunk(user.accessToken, upload.uploadId, 0, app.sliceChunk(bytes, 0)).expect(200);
    const cleanup = app.dependencies.scheduledJobs.find((job) => job.id === "media-abandoned-uploads-cleanup");
    await cleanup?.run();
    await app.client.get(`/api/v1/media/uploads/${upload.uploadId}`).auth(user.accessToken).expect(200);

    app.clock.advanceBySeconds(25 * 3_600);
    await cleanup?.run();
    const login = await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(200);
    await app.client.get(`/api/v1/media/uploads/${upload.uploadId}`).auth(login.json<{ accessToken: string }>().accessToken).expect(404);
    expect(app.blobs.listKeys(`private/uploads/${upload.uploadId}/`)).toEqual([]);
  });
});
