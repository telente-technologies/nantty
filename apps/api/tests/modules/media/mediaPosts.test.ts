import { afterAll, describe, expect, it } from "vitest";

import { buildMp4Bytes, buildPngBytes, createMediaTestApplication } from "./mediaSetup.fixture.js";

const app = createMediaTestApplication();
afterAll(async () => {
  await app.processingQueue.close();
  await app.close();
});

interface PostMediaBody {
  readonly type: string;
  readonly url: string;
  readonly mediaId?: string;
  readonly posterUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly blurhash?: string;
}

describe("posts with uploaded media", () => {
  it("refuses media that is still processing, then attaches ready media", async () => {
    const author = await app.registerUser();
    let openGate = () => {};
    app.imageProcessor.gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const mediaId = await app.uploadWholeFile(author.accessToken, buildPngBytes(900));
    const pending = await app.client.post("/api/v1/posts").auth(author.accessToken).send({ text: "look", mediaIds: [mediaId] }).expect(409);
    expect(pending.json<{ message: string }>().message).toBe("Media is still processing");
    app.imageProcessor.gate = undefined;
    openGate();
    await app.processingQueue.waitUntilIdle();

    const created = await app.client.post("/api/v1/posts").auth(author.accessToken).send({ text: "look", mediaIds: [mediaId] }).expect(201);
    const [media] = created.json<{ media: PostMediaBody[] }>().media;
    expect(media).toMatchObject({ type: "image", mediaId, width: 800, height: 400, blurhash: expect.any(String) });
    expect(media?.url).toMatch(new RegExp(`^/api/v1/media/files/public/media/${mediaId}/[a-f0-9]{32}\\.webp$`));
  });

  it("attaches a ready video clip with its HLS master and poster", async () => {
    const author = await app.registerUser();
    const mediaId = await app.uploadWholeFile(author.accessToken, buildMp4Bytes(1_500), { mimeType: "video/mp4", purpose: "clip" });
    await app.processingQueue.waitUntilIdle();
    const created = await app.client.post("/api/v1/posts").auth(author.accessToken).send({ kind: "clip", media: [{ mediaId, type: "video" }] }).expect(201);
    const [media] = created.json<{ media: PostMediaBody[] }>().media;
    expect(media).toMatchObject({ type: "video", mediaId, posterUrl: expect.stringMatching(/\.jpg$/) });
    expect(media?.url).toMatch(/master\.m3u8$/);
  });

  it("rejects failed media, media of other users and unknown ids", async () => {
    const author = await app.registerUser();
    const stranger = await app.registerUser();
    app.imageProcessor.failuresBeforeSuccess = 3;
    const failed = await app.uploadWholeFile(author.accessToken, buildPngBytes(600));
    await app.processingQueue.waitUntilIdle();
    app.imageProcessor.failuresBeforeSuccess = 0;
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ mediaIds: [failed] }).expect(422);

    const theirs = await app.uploadWholeFile(stranger.accessToken, buildPngBytes(600));
    await app.processingQueue.waitUntilIdle();
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ mediaIds: [theirs] }).expect(404);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ mediaIds: ["11111111-1111-4111-8111-111111111111"] }).expect(404);
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ text: "x", mediaIds: Array.from({ length: 11 }, () => theirs) }).expect(400);
  });

  it("keeps plain media urls working", async () => {
    const author = await app.registerUser();
    await app.client.post("/api/v1/posts").auth(author.accessToken).send({ media: [{ url: "https://cdn.example.com/a.jpg", type: "image" }] }).expect(201);
  });
});
