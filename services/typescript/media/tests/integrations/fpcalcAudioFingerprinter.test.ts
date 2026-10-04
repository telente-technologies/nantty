import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildFpcalcArgs, createFpcalcAudioFingerprinter, parseFpcalcOutput } from "../../src/integrations/fpcalcAudioFingerprinter.integration.js";
import { createGetAudioFingerprintHandler } from "../../src/modules/internal/queries/getAudioFingerprint/getAudioFingerprint.handler.js";
import { createHarness, testConfig, unavailableTranscoder } from "../fakes/pipelineHarness.js";

describe("chromaprint audio fingerprints", () => {
  it("parses fpcalc raw JSON and rejects anything else", () => {
    expect(parseFpcalcOutput(JSON.stringify({ duration: 12.5, fingerprint: [1, -2, 3] }))).toEqual({ algorithm: "chromaprint", durationSeconds: 12.5, fingerprint: [1, -2, 3] });
    expect(parseFpcalcOutput("not json")).toBeNull();
    expect(parseFpcalcOutput(JSON.stringify({ fingerprint: "AQAA" }))).toBeNull();
    expect(buildFpcalcArgs("/work/a.m4a")).toEqual(["-raw", "-json", "-length", "180", "/work/a.m4a"]);
  });

  it("returns a placeholder when fpcalc is not installed", async () => {
    const fingerprint = createFpcalcAudioFingerprinter(async () => { throw new Error("ENOENT"); }, testConfig().ffmpeg);
    await expect(fingerprint("/work/a.m4a")).resolves.toBeNull();
  });

  it("fingerprints the original, never the muted, rendition of a ready clip", async () => {
    const seen: string[] = [];
    const harness = createHarness({ transcoder: { ...unavailableTranscoder, computeAudioFingerprint: async (path) => (seen.push(path), { algorithm: "chromaprint", durationSeconds: 9, fingerprint: [7, 8, 9] }) } });
    const id = randomUUID();
    const bucket = harness.context.config.storage.publicBucket;
    harness.db.insertAsset({ id, ownerId: randomUUID(), purpose: "clip", kind: "video", status: "ready", declaredMimeType: "video/mp4", sizeBytes: 3n, quarantineBucket: "q", quarantineKey: "gone" });
    harness.db.variants.push({ id: randomUUID(), assetId: id, bucket, key: `m/${id}/muted/video.mp4`, format: "mp4", width: 1, height: 1, bitrateKbps: null, sizeBytes: 3n });
    harness.db.variants.push({ id: randomUUID(), assetId: id, bucket, key: `m/${id}/video.mp4`, format: "mp4", width: 1, height: 1, bitrateKbps: null, sizeBytes: 3n });
    harness.storage.seed(bucket, `m/${id}/video.mp4`, Buffer.from("mp4"));
    const view = await createGetAudioFingerprintHandler(harness.context)({ mediaId: id });
    expect(view).toMatchObject({ mediaId: id, available: true, fingerprint: { fingerprint: [7, 8, 9] } });
    expect(seen[0]?.endsWith("source.mp4")).toBe(true);
  });
});
