import { afterAll, describe, expect, it } from "vitest";

import { buildMp4Bytes, buildPdfBytes, buildPngBytes, createMediaTestApplication } from "./mediaSetup.fixture.js";

const app = createMediaTestApplication();
afterAll(async () => {
  await app.processingQueue.close();
  await app.close();
});

interface MediaAssetBody {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds?: number;
  readonly blurhash?: string;
  readonly posterUrl?: string;
  readonly hlsUrl?: string;
  readonly originalUrl?: string;
  readonly failureReason?: string;
  readonly variants: readonly { url: string; width: number; height: number; format: string; bitrateKbps?: number }[];
}

async function readMedia(mediaId: string, accessToken?: string, status = 200): Promise<MediaAssetBody> {
  const request = app.client.get(`/api/v1/media/${mediaId}`);
  const response = await (accessToken === undefined ? request : request.auth(accessToken)).expect(status);
  return response.json<MediaAssetBody>();
}

describe("media processing", () => {
  it("processes an image into public immutable variants", async () => {
    const owner = await app.registerUser();
    let openGate = () => {};
    app.imageProcessor.gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const mediaId = await app.uploadWholeFile(owner.accessToken, buildPngBytes(2_500));
    const processing = await readMedia(mediaId, owner.accessToken);
    expect(processing.status).toBe("processing");
    await app.client.get(`/api/v1/media/${mediaId}`).expect(404);
    app.imageProcessor.gate = undefined;
    openGate();

    await app.processingQueue.waitUntilIdle();
    const ready = await readMedia(mediaId);
    expect(ready).toMatchObject({ id: mediaId, type: "image", status: "ready", width: 800, height: 400, blurhash: expect.any(String) });
    expect(ready.variants).toHaveLength(6);
    expect(new Set(ready.variants.map((variant) => variant.format))).toEqual(new Set(["avif", "webp", "jpeg"]));

    const variant = ready.variants.find((entry) => entry.format === "webp") as MediaAssetBody["variants"][number];
    expect(variant.url).toMatch(new RegExp(`^/api/v1/media/files/public/media/${mediaId}/[a-f0-9]{32}\\.webp$`));
    const file = await app.client.get(variant.url).expect(200);
    expect(file.header("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(file.header("content-type")).toMatch(/image\/webp/);
    await app.client.get(`/api/v1/media/files/private/originals/${mediaId}`).expect(404);

    const upload = await app.client.get(`/api/v1/media/files/${variant.url.slice("/api/v1/media/files/".length)}`).set("range", "bytes=0-3").expect(206);
    expect(upload.bytes).toHaveLength(4);
  });

  it("processes a video into mp4, HLS and a poster", async () => {
    const owner = await app.registerUser();
    const mediaId = await app.uploadWholeFile(owner.accessToken, buildMp4Bytes(3_000), { mimeType: "video/mp4", purpose: "clip", fileName: "clip.mp4" });
    await app.processingQueue.waitUntilIdle();
    const ready = await readMedia(mediaId);
    expect(ready).toMatchObject({ type: "video", status: "ready", durationSeconds: 12, width: 1920, height: 1080 });
    expect(ready.hlsUrl).toMatch(new RegExp(`/public/media/${mediaId}/hls-[a-f0-9]{32}/master\\.m3u8$`));
    expect(ready.posterUrl).toMatch(/\.jpg$/);
    expect(ready.variants.map((variant) => variant.format).sort()).toEqual(["hls", "mp4"]);
    const segment = (ready.hlsUrl as string).replace("master.m3u8", "360p/segment_0000.ts");
    await app.client.get(segment).expect(200).expect("content-type", /video\/mp2t/);
  });

  it("fails videos longer than the purpose allows without retrying", async () => {
    const owner = await app.registerUser();
    app.videoProcessor.durationSeconds = 90;
    const mediaId = await app.uploadWholeFile(owner.accessToken, buildMp4Bytes(1_500), { mimeType: "video/mp4", purpose: "story" });
    await app.processingQueue.waitUntilIdle();
    app.videoProcessor.durationSeconds = 12;
    expect(await readMedia(mediaId, owner.accessToken)).toMatchObject({ status: "failed", failureReason: expect.stringContaining("60 seconds") });
  });

  it("retries with exponential backoff, then dead-letters and marks the media failed", async () => {
    const owner = await app.registerUser();
    app.imageProcessor.attemptTimes.length = 0;
    app.imageProcessor.failuresBeforeSuccess = 2;
    const recovered = await app.uploadWholeFile(owner.accessToken, buildPngBytes(700));
    await app.processingQueue.waitUntilIdle();
    expect((await readMedia(recovered)).status).toBe("ready");
    const [first, second, third] = app.imageProcessor.attemptTimes as [number, number, number];
    expect(second - first).toBeGreaterThanOrEqual(18);
    expect(third - second).toBeGreaterThanOrEqual(38);

    const deadLetteredBefore = await app.processingQueue.countDeadLetteredJobs();
    app.imageProcessor.failuresBeforeSuccess = 3;
    const broken = await app.uploadWholeFile(owner.accessToken, buildPngBytes(700));
    await app.processingQueue.waitUntilIdle();
    app.imageProcessor.failuresBeforeSuccess = 0;
    expect(await readMedia(broken, owner.accessToken)).toMatchObject({ status: "failed", failureReason: expect.any(String), variants: [] });
    expect(await app.processingQueue.countDeadLetteredJobs()).toBe(deadLetteredBefore + 1);
    await app.client.get(`/api/v1/media/${broken}`).expect(404);
  });

  it("keeps kyc documents private to the owner and admins", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    const admin = await app.registerAdmin();
    const mediaId = await app.uploadWholeFile(owner.accessToken, buildPdfBytes(1_200), { mimeType: "application/pdf", purpose: "kyc", fileName: "id.pdf" });
    await app.processingQueue.waitUntilIdle();

    const ownerView = await readMedia(mediaId, owner.accessToken);
    expect(ownerView).toMatchObject({ type: "document", status: "ready", variants: [], originalUrl: `/api/v1/media/${mediaId}/original` });
    expect(ownerView.hlsUrl ?? ownerView.posterUrl).toBeUndefined();
    expect((await readMedia(mediaId, admin.accessToken)).variants).toEqual([]);
    await readMedia(mediaId, stranger.accessToken, 404);
    await readMedia(mediaId, undefined, 404);

    const original = await app.client.get(`/api/v1/media/${mediaId}/original`).auth(admin.accessToken).expect(200);
    expect(original.header("cache-control")).toBe("private, no-store");
    await app.client.get(`/api/v1/media/${mediaId}/original`).auth(stranger.accessToken).expect(404);
    await app.client.get(`/api/v1/media/${mediaId}/original`).expect(401);
    expect(app.blobs.listKeys(`public/media/${mediaId}/`)).toEqual([]);
  });

  it("keeps voice notes owner-only", async () => {
    const owner = await app.registerUser();
    const admin = await app.registerAdmin();
    const ogg = new Uint8Array(400);
    ogg.set(new TextEncoder().encode("OggS"));
    const mediaId = await app.uploadWholeFile(owner.accessToken, ogg, { mimeType: "audio/ogg", purpose: "voice", fileName: "note.ogg" });
    await app.processingQueue.waitUntilIdle();
    expect(await readMedia(mediaId, owner.accessToken)).toMatchObject({ type: "audio", status: "ready", variants: [] });
    await readMedia(mediaId, admin.accessToken, 404);
  });

  it("lets only the owner delete media and removes its public files", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    const mediaId = await app.uploadWholeFile(owner.accessToken, buildPngBytes(500));
    await app.processingQueue.waitUntilIdle();
    await app.client.delete(`/api/v1/media/${mediaId}`).auth(stranger.accessToken).expect(404);
    await app.client.delete(`/api/v1/media/${mediaId}`).auth(owner.accessToken).expect(204);
    await readMedia(mediaId, undefined, 404);
    expect(app.blobs.listKeys(`public/media/${mediaId}/`)).toEqual([]);
  });
});
