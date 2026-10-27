import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { renderDownloadVariantJobType } from "../../src/constants/media.constant.js";
import type { BrandedDownloadRenderer, BrandedVideoInput } from "../../src/interfaces/brandedDownloadRenderer.interface.js";
import { createMediaJobHandlers } from "../../src/jobs/mediaJobHandlers.job.js";
import { deleteMediaAssets } from "../../src/modules/assets/services/mediaDeletion.service.js";
import { createRequestDownloadVariantHandler, estimateDownloadRenderProgress } from "../../src/modules/downloads/commands/requestDownloadVariant/requestDownloadVariant.handler.js";
import { createHarness, firstAttempt } from "../fakes/pipelineHarness.js";

function createRecordingRenderer() {
  const videoInputs: BrandedVideoInput[] = [];
  const renderer: BrandedDownloadRenderer = {
    renderBrandedImage: async ({ outputPath }) => {
      await writeFile(outputPath, "branded-jpeg");
      return { path: outputPath, contentType: "image/jpeg", format: "jpg", sizeBytes: 12 };
    },
    renderBrandedVideo: async (input) => {
      videoInputs.push(input);
      const path = `${input.workDirectory}/download.mp4`;
      await writeFile(path, "branded-mp4");
      return { path, contentType: "video/mp4", format: "mp4", sizeBytes: 11 };
    },
  };
  return { renderer, videoInputs };
}

function seedReadyAsset(options: { kind?: "video" | "image"; purpose?: string; status?: string; muted?: boolean } = {}) {
  const recording = createRecordingRenderer();
  const harness = createHarness({ branding: recording.renderer });
  const id = randomUUID();
  const kind = options.kind ?? "video";
  const bucket = harness.context.config.storage.publicBucket;
  const name = kind === "video" ? `${options.muted === true ? "muted/" : ""}video.mp4` : "w1080.jpeg";
  harness.db.insertAsset({ id, ownerId: randomUUID(), purpose: options.purpose ?? "clip", kind, status: options.status ?? "ready", declaredMimeType: kind === "video" ? "video/mp4" : "image/jpeg", sizeBytes: 10n, quarantineBucket: "q", quarantineKey: "gone", durationSeconds: 10 });
  harness.db.variants.push({ id: randomUUID(), assetId: id, bucket, key: `m/${id}/${name}`, format: kind === "video" ? "mp4" : "jpeg", width: 720, height: 1280, bitrateKbps: null, sizeBytes: 3n });
  harness.storage.seed(bucket, `m/${id}/${name}`, Buffer.from("source"));
  return { harness, id, ...recording, request: createRequestDownloadVariantHandler(harness.context) };
}

describe("branded download variants", () => {
  it("queues a video render once, then serves a signed private copy with an access log", async () => {
    const { harness, id, request, videoInputs } = seedReadyAsset();
    const first = await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "@Ada", stripAudio: false });
    expect(first).toMatchObject({ status: "processing" });
    const again = await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "ada", stripAudio: false });
    expect(again.status).toBe("processing");
    expect(harness.enqueued.filter((entry) => entry.job.type === renderDownloadVariantJobType)).toHaveLength(1);

    await createMediaJobHandlers(harness.context)[renderDownloadVariantJobType]?.(harness.enqueued[0]?.job.payload ?? {}, firstAttempt);
    expect(videoInputs[0]).toMatchObject({ watermarkHandle: "ada", stripAudio: false });

    const ready = await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "ada", stripAudio: false });
    expect(ready).toMatchObject({ status: "ready", progress: 1, contentType: "video/mp4", fileName: `nantty-ada-${id.slice(0, 8)}.mp4` });
    const stored = harness.storage.keysIn(harness.context.config.storage.privateBucket);
    expect(stored.some((key) => key.startsWith(`p/${id}/download/`))).toBe(true);
    expect(harness.db.accessLogs).toHaveLength(1);
  });

  it("keeps copyright-muted clips silent in the download", async () => {
    const { harness, id, request, videoInputs } = seedReadyAsset({ muted: true });
    await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "ada", stripAudio: false });
    await createMediaJobHandlers(harness.context)[renderDownloadVariantJobType]?.(harness.enqueued[0]?.job.payload ?? {}, firstAttempt);
    expect(videoInputs[0]?.stripAudio).toBe(true);
  });

  it("renders images inline and returns them ready", async () => {
    const { id, request } = seedReadyAsset({ kind: "image", purpose: "post" });
    expect(await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "ada", stripAudio: false })).toMatchObject({ status: "ready", contentType: "image/jpeg" });
  });

  it("refuses unready, non-social and badly named requests", async () => {
    const unready = seedReadyAsset({ status: "processing" });
    await expect(unready.request({ mediaId: unready.id, requesterId: "v", watermarkHandle: "ada", stripAudio: false })).rejects.toMatchObject({ code: "MEDIA_NOT_READY" });
    const avatar = seedReadyAsset({ kind: "image", purpose: "avatar" });
    await expect(avatar.request({ mediaId: avatar.id, requesterId: "v", watermarkHandle: "ada", stripAudio: false })).rejects.toMatchObject({ code: "MEDIA_NOT_DOWNLOADABLE" });
    await expect(avatar.request({ mediaId: avatar.id, requesterId: "v", watermarkHandle: "a b", stripAudio: false })).rejects.toMatchObject({ code: "INVALID_WATERMARK_HANDLE" });
  });

  it("drops cached downloads when the media is deleted", async () => {
    const { harness, id, request } = seedReadyAsset({ kind: "image", purpose: "post" });
    await request({ mediaId: id, requesterId: "viewer-1", watermarkHandle: "ada", stripAudio: false });
    await deleteMediaAssets(harness.context, [id], "requested");
    expect(harness.db.downloadVariants).toHaveLength(0);
    expect(harness.storage.keysIn(harness.context.config.storage.privateBucket).some((key) => key.includes("/download/"))).toBe(false);
  });

  it("estimates progress from elapsed render time", () => {
    const now = new Date("2026-10-04T12:00:10Z");
    expect(estimateDownloadRenderProgress({ status: "pending", startedAt: null }, 10, now)).toBe(0.02);
    expect(estimateDownloadRenderProgress({ status: "rendering", startedAt: new Date("2026-10-04T12:00:05Z") }, 10, now)).toBe(0.5);
    expect(estimateDownloadRenderProgress({ status: "rendering", startedAt: new Date("2026-10-04T11:00:00Z") }, 10, now)).toBe(0.95);
  });
});
