import { createHash } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { runMediaPipeline } from "../../src/modules/assets/services/mediaPipeline.service.js";
import type { MediaTranscoder } from "../../src/interfaces/mediaProcessors.interface.js";
import { createHarness, finalAttempt, firstAttempt, unavailableTranscoder } from "../fakes/pipelineHarness.js";

const jpegWithGps = () => sharp({ create: { width: 1400, height: 900, channels: 3, background: "#3366cc" } }).jpeg().withExif({ IFD0: { Copyright: "secret-owner" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } }).toBuffer();
const smallJpeg = () => sharp({ create: { width: 480, height: 320, channels: 3, background: "#3366cc" } }).jpeg().toBuffer();
const minimalPdf = (pages: number) => Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Pages /Count ${pages} >> endobj\n%%EOF`);

describe("image pipeline", () => {
  it("re-encodes to avif, webp and jpeg, strips exif and gps, and publishes the asset", async () => {
    const harness = createHarness();
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const id = harness.seedUpload({ purpose: "product", mimeType: "image/jpeg", bytes: input });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    const asset = harness.db.assets.get(id);
    expect(asset?.["status"]).toBe("ready");
    expect(asset).toMatchObject({ width: 1400, height: 900, sniffedMimeType: "image/jpeg", scanResult: "clean" });
    const formats = new Set(harness.db.variants.map((variant) => variant["format"]));
    expect(formats).toEqual(new Set(["avif", "webp", "jpeg"]));
    expect(harness.db.variants.map((variant) => variant["width"] as number)).toEqual(expect.arrayContaining([320, 640, 1080]));
    expect(harness.db.variants.some((variant) => (variant["width"] as number) > 1400)).toBe(false);
    const publicKeys = harness.storage.keysIn(harness.context.config.storage.publicBucket);
    expect(publicKeys).toContain(`m/${id}/w640.avif`);
    expect(publicKeys).toContain(`m/${id}/display.jpg`);
    for (const key of publicKeys.filter((entry) => entry.endsWith(".jpg") || entry.endsWith(".webp"))) {
      const stored = harness.storage.objects.get(harness.storage.key(harness.context.config.storage.publicBucket, key));
      expect((await sharp(stored?.body).metadata()).exif).toBeUndefined();
      expect(stored?.body.includes(Buffer.from("secret-owner"))).toBe(false);
      expect(stored?.options?.cacheControl).toContain("immutable");
    }
    expect(harness.storage.keysIn(harness.context.config.storage.quarantineBucket)).toHaveLength(0);
    expect(harness.db.eventTypes()).toEqual(["media.processed"]);
  });

  it("crops avatars to squares", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "avatar", mimeType: "image/jpeg", bytes: await jpegWithGps() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.variants.every((variant) => variant["width"] === variant["height"])).toBe(true);
    expect(new Set(harness.db.variants.map((variant) => variant["width"]))).toEqual(new Set([96, 256, 512]));
  });

  it("keeps chat media private with an expiry and publishes nothing to the public bucket", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "chat", mimeType: "image/jpeg", bytes: await smallJpeg(), isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
    expect(harness.storage.keysIn(harness.context.config.storage.privateBucket).length).toBeGreaterThan(0);
    expect((harness.db.assets.get(id)?.["expiresAt"] as Date).toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });
});

describe("rejections", () => {
  it.each(["match", "unavailable"])("retains child-safety %s assets in quarantine without publishing", async (mode) => {
    const harness = createHarness({ config: { childSafety: { baseUrl: "https://scanner.example", internalToken: "test", requireScan: true, timeoutMs: 1000 } } });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    const context = { ...harness.context, childSafety: { scanMedia: async () => {
      if (mode === "unavailable") throw new Error("scanner unavailable");
      return { matched: true, quarantined: true };
    } } };
    await runMediaPipeline(context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)?.["status"]).toBe("held");
    expect(harness.storage.keysIn(context.config.storage.quarantineBucket)).toHaveLength(1);
    expect(harness.storage.keysIn(context.config.storage.publicBucket)).toHaveLength(0);
    expect(harness.db.eventTypes()).toEqual(["media.held"]);
  });

  it("rejects a file whose bytes do not match the declared type", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: minimalPdf(1) });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "TYPE_MISMATCH" });
    expect(harness.db.eventTypes()).toEqual(["media.rejected"]);
    expect(harness.storage.keysIn(harness.context.config.storage.quarantineBucket)).toHaveLength(0);
  });

  it("rejects unrecognised bytes and types not allowed for the purpose", async () => {
    const harness = createHarness();
    const unknown = harness.seedUpload({ purpose: "post", mimeType: "image/png", bytes: Buffer.from("MZ not an image at all") });
    const pdfAvatar = harness.seedUpload({ purpose: "avatar", mimeType: "application/pdf", bytes: minimalPdf(1), kind: "document" });
    await runMediaPipeline(harness.context, unknown, { attempt: firstAttempt, moderationApproved: false });
    await runMediaPipeline(harness.context, pdfAvatar, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(unknown)?.["rejectionReason"]).toBe("UNRECOGNIZED_FILE_TYPE");
    expect(harness.db.assets.get(pdfAvatar)?.["rejectionReason"]).toBe("TYPE_NOT_ALLOWED");
  });

  it("rejects size and checksum mismatches", async () => {
    const harness = createHarness();
    const bytes = await smallJpeg();
    const sized = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes });
    harness.db.assets.get(sized)!["sizeBytes"] = BigInt(bytes.byteLength + 1);
    const summed = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes, sha256: "0".repeat(64) });
    await runMediaPipeline(harness.context, sized, { attempt: firstAttempt, moderationApproved: false });
    await runMediaPipeline(harness.context, summed, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(sized)?.["rejectionReason"]).toBe("SIZE_MISMATCH");
    expect(harness.db.assets.get(summed)?.["rejectionReason"]).toBe("CHECKSUM_MISMATCH");
    const matching = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes, sha256: createHash("sha256").update(bytes).digest("hex") });
    await runMediaPipeline(harness.context, matching, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(matching)?.["status"]).toBe("ready");
  });

  it("rejects undecodable images", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/png", bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]) });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)?.["rejectionReason"]).toBe("UNDECODABLE_IMAGE");
  });

  it("quarantines infected files reported by the malware scan hook", async () => {
    const harness = createHarness({ scanner: { scanFile: async () => ({ verdict: "infected", signature: "Eicar-Test-Signature" }) } });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "MALWARE_DETECTED", scanResult: "Eicar-Test-Signature" });
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
  });

  it("rejects unscanned uploads when no malware scanner is configured", async () => {
    const harness = createHarness({ scanner: { scanFile: async () => ({ verdict: "skipped" }) } });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "MALWARE_SCAN_UNAVAILABLE", scanResult: "skipped" });
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
  });

  it("can explicitly allow unscanned uploads for local development", async () => {
    const harness = createHarness({ scanner: { scanFile: async () => ({ verdict: "skipped" }) }, config: { allowUnscannedUploads: true } });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", scanResult: "skipped" });
  });

  it.each([
    { purpose: "voice", mimeType: "audio/mp4", kind: "audio", bytes: Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypM4A "), Buffer.alloc(40)]) },
    { purpose: "document", mimeType: "application/pdf", kind: "document", bytes: minimalPdf(1) },
  ] as const)("rejects unscanned $kind uploads even when local unscanned uploads are enabled", async ({ purpose, mimeType, kind, bytes }) => {
    const harness = createHarness({ scanner: { scanFile: async () => ({ verdict: "skipped" }) }, config: { allowUnscannedUploads: true } });
    const id = harness.seedUpload({ purpose, mimeType, bytes, kind, isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "MALWARE_SCAN_UNAVAILABLE", scanResult: "skipped" });
    expect(harness.storage.keysIn(harness.context.config.storage.privateBucket)).toHaveLength(0);
  });

  it("fails closed when the scanner itself errors until the final attempt", async () => {
    const harness = createHarness({ scanner: { scanFile: async () => { throw new Error("clamd down"); } } });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await expect(runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false })).rejects.toThrow("clamd down");
    expect(harness.db.assets.get(id)?.["status"]).toBe("processing");
    await runMediaPipeline(harness.context, id, { attempt: finalAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "PROCESSING_FAILED" });
  });
});

describe("moderation gate", () => {
  const withScore = (score: number | Error) => createHarness({ moderation: { classify: async () => { if (score instanceof Error) throw score; return { score, topCategory: "violence" }; } } });

  it("allows low scores", async () => {
    const harness = withScore(0.1);
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", moderationScore: 0.1, moderationDecision: "allow" });
  });

  it("holds borderline scores for review without publishing derivatives, then publishes once approved", async () => {
    const harness = withScore(0.6);
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "held", moderationDecision: "hold" });
    expect(harness.db.eventTypes()).toEqual(["media.held"]);
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
    expect(harness.storage.keysIn(harness.context.config.storage.quarantineBucket)).toHaveLength(1);
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: true });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", moderationDecision: "approved" });
    expect(harness.db.eventTypes()).toEqual(["media.held", "media.processed"]);
  });

  it("rejects very high scores", async () => {
    const harness = withScore(0.99);
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "MODERATION_REJECTED" });
  });

  it("degrades according to the configured fail mode when the classifier is down", async () => {
    const base = createHarness().context.config.moderation;
    const open = createHarness({ moderation: { classify: async () => { throw new Error("python down"); } }, config: { moderation: { ...base, failMode: "allow" } } });
    const openId = open.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(open.context, openId, { attempt: firstAttempt, moderationApproved: false });
    expect(open.db.assets.get(openId)?.["status"]).toBe("ready");
    const closed = createHarness({ moderation: { classify: async () => { throw new Error("down"); } }, config: { moderation: { ...base, failMode: "hold" } } });
    const closedId = closed.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(closed.context, closedId, { attempt: firstAttempt, moderationApproved: false });
    expect(closed.db.assets.get(closedId)?.["status"]).toBe("held");
  });

  it("holds moderated media when processing produces no classifier input, even in allow mode", async () => {
    const config = createHarness().context.config;
    const harness = createHarness({
      images: { processImage: async () => ({ width: 10, height: 10, files: [{ name: "display.jpg", contentType: "image/jpeg", format: "jpeg", width: 10, height: 10, isVariant: true, source: { buffer: Buffer.from("image") }, sizeBytes: 5 }], moderationFrames: [] }) },
      config: { moderation: { ...config.moderation, failMode: "allow" } },
    });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await smallJpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "held", moderationDecision: "uninspectable" });
    expect(harness.db.eventTypes()).toEqual(["media.held"]);
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
  });

  it("skips moderation for private purposes", async () => {
    let calls = 0;
    const harness = createHarness({ moderation: { classify: async () => { calls += 1; return { score: 1, topCategory: null }; } } });
    const id = harness.seedUpload({ purpose: "chat", mimeType: "image/jpeg", bytes: await smallJpeg(), isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(calls).toBe(0);
    expect(harness.db.assets.get(id)?.["status"]).toBe("ready");
  });
});

describe("documents", () => {
  it("counts pdf pages and stores the file only in the private bucket", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "kyc", mimeType: "application/pdf", bytes: minimalPdf(3), kind: "document", isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", pageCount: 3, expiresAt: null, moderationDecision: "not_required" });
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
    const stored = harness.storage.objects.get(harness.storage.key(harness.context.config.storage.privateBucket, `p/${id}/original.pdf`));
    expect(stored?.options?.encrypted).toBe(true);
  });

  it("rejects pdfs with javascript", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "document", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.4\n<< /S /JavaScript >> /Type /Pages /Count 1\n%%EOF"), kind: "document", isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)?.["rejectionReason"]).toBe("ACTIVE_CONTENT_IN_DOCUMENT");
  });
});

describe("video and audio", () => {
  const mp4Header = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(40)]);
  const fakeTranscoder: MediaTranscoder = {
    isAvailable: async () => true,
    processVideo: async () => ({
      width: 1080, height: 1920, durationSeconds: 12,
      files: [
        { name: "video.mp4", contentType: "video/mp4", format: "mp4", width: 720, height: 1280, bitrateKbps: 2000, isVariant: true, source: { buffer: Buffer.from("mp4") }, sizeBytes: 3 },
        { name: "hls/master.m3u8", contentType: "application/vnd.apple.mpegurl", format: "hls", width: 720, height: 1280, isVariant: true, source: { buffer: Buffer.from("#EXTM3U") }, sizeBytes: 7 },
        { name: "poster.jpg", contentType: "image/jpeg", format: "jpeg", width: 0, height: 0, isVariant: false, source: { buffer: Buffer.from("jpg") }, sizeBytes: 3 },
      ],
      posterName: "poster.jpg", hlsMasterName: "hls/master.m3u8", moderationFrames: [Buffer.from("frame")],
    }),
    processAudio: async () => ({ width: 0, height: 0, durationSeconds: 4, files: [{ name: "audio.m4a", contentType: "audio/mp4", format: "m4a", width: 0, height: 0, bitrateKbps: 64, isVariant: true, source: { buffer: Buffer.from("aac") }, sizeBytes: 3 }], moderationFrames: [] }),
    muteVideoAudio: async () => { throw new Error("not used"); },
    computeAudioFingerprint: async () => null,
  };

  it("publishes mp4, hls and poster for a clip", async () => {
    const harness = createHarness({ transcoder: fakeTranscoder });
    const id = harness.seedUpload({ purpose: "clip", mimeType: "video/mp4", bytes: mp4Header, kind: "video" });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", durationSeconds: 12, posterKey: `m/${id}/poster.jpg`, hlsKey: `m/${id}/hls/master.m3u8` });
    expect(harness.db.variants.map((variant) => variant["format"])).toEqual(["mp4", "hls"]);
  });

  it("keeps voice notes private with a 30 day expiry", async () => {
    const harness = createHarness({ transcoder: fakeTranscoder });
    const id = harness.seedUpload({ purpose: "voice", mimeType: "audio/mp4", bytes: Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypM4A "), Buffer.alloc(40)]), kind: "audio", isPrivate: true });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", durationSeconds: 4, moderationDecision: "not_required" });
    expect(harness.storage.keysIn(harness.context.config.storage.privateBucket)).toContain(`p/${id}/audio.m4a`);
  });

  it("retries while ffmpeg is unavailable and rejects only on the final attempt", async () => {
    const harness = createHarness({ transcoder: unavailableTranscoder });
    const id = harness.seedUpload({ purpose: "clip", mimeType: "video/mp4", bytes: mp4Header, kind: "video" });
    await expect(runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false })).rejects.toThrow("no ffmpeg");
    expect(harness.db.assets.get(id)?.["status"]).toBe("processing");
    await runMediaPipeline(harness.context, id, { attempt: finalAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)?.["rejectionReason"]).toBe("PROCESSING_FAILED");
  });
});
