import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createMediaJobHandlers } from "../../src/jobs/mediaJobHandlers.job.js";
import type { MediaTranscoder } from "../../src/interfaces/mediaProcessors.interface.js";
import { handleDomainEventForMedia } from "../../src/modules/assets/services/chatMediaExpiryEvent.service.js";
import { originalKeyForMutedKey } from "../../src/modules/assets/services/audioRemedy.service.js";
import { buildSilentSoundtrackArgs } from "../../src/utils/ffmpegCommands.util.js";
import { createHarness, firstAttempt, unavailableTranscoder } from "../fakes/pipelineHarness.js";

const mutedInputs: string[] = [];
const fakeMuter: MediaTranscoder = {
  ...unavailableTranscoder,
  isAvailable: async () => true,
  muteVideoAudio: async ({ inputPath }) => {
    mutedInputs.push(inputPath);
    return {
      width: 720, height: 1280, durationSeconds: 12, hlsMasterName: "muted/hls/master.m3u8", moderationFrames: [],
      files: [
        { name: "muted/video.mp4", contentType: "video/mp4", format: "mp4", width: 720, height: 1280, isVariant: true, source: { buffer: Buffer.from("silent-mp4") }, sizeBytes: 10 },
        { name: "muted/hls/master.m3u8", contentType: "application/vnd.apple.mpegurl", format: "hls", width: 720, height: 1280, isVariant: true, source: { buffer: Buffer.from("#EXTM3U") }, sizeBytes: 7 },
        { name: "muted/hls/720p/segment00000.ts", contentType: "video/mp2t", format: "ts", width: 0, height: 0, isVariant: false, source: { buffer: Buffer.from("ts") }, sizeBytes: 2 },
      ],
    };
  },
};

function seedReadyClip() {
  const harness = createHarness({ transcoder: fakeMuter });
  const id = randomUUID();
  const bucket = harness.context.config.storage.publicBucket;
  harness.db.insertAsset({ id, ownerId: randomUUID(), purpose: "clip", kind: "video", status: "ready", declaredMimeType: "video/mp4", sizeBytes: 10n, quarantineBucket: "q", quarantineKey: "gone", hlsKey: `m/${id}/hls/master.m3u8`, posterKey: `m/${id}/poster.jpg` });
  for (const [name, format] of [["video.mp4", "mp4"], ["hls/master.m3u8", "hls"]] as const) {
    harness.db.variants.push({ id: randomUUID(), assetId: id, bucket, key: `m/${id}/${name}`, format, width: 720, height: 1280, bitrateKbps: null, sizeBytes: 3n });
    harness.storage.seed(bucket, `m/${id}/${name}`, Buffer.from("original"));
  }
  return { harness, id, bucket };
}

const envelope = (type: string, mediaIds: string[]) => ({ id: randomUUID(), type, data: { claimId: "claim-1", mediaIds } });

describe("copyright audio remedy", () => {
  it("swaps a claimed clip to a muted rendition and back after a counter-notice", async () => {
    const { harness, id, bucket } = seedReadyClip();
    await handleDomainEventForMedia(harness.context, envelope("clipAudio.muteRequested", [id, "not-a-uuid"]));
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.enqueued[0]?.job).toMatchObject({ type: "media.muteAudio", payload: { mediaId: id, claimId: "claim-1", mode: "mute" } });
    const handlers = createMediaJobHandlers(harness.context);
    await handlers["media.muteAudio"]?.(harness.enqueued[0]?.job.payload ?? {}, firstAttempt);
    expect(mutedInputs.length).toBeGreaterThan(0);
    expect(harness.db.assets.get(id)?.["hlsKey"]).toBe(`m/${id}/muted/hls/master.m3u8`);
    expect(harness.db.variants.filter((variant) => variant["assetId"] === id).map((variant) => variant["key"]).sort()).toEqual([`m/${id}/muted/hls/master.m3u8`, `m/${id}/muted/video.mp4`]);
    expect(harness.storage.keysIn(bucket)).toEqual(expect.arrayContaining([`m/${id}/muted/video.mp4`, `m/${id}/muted/hls/720p/segment00000.ts`, `m/${id}/video.mp4`]));
    expect(harness.db.eventTypes()).toEqual(["media.processed", "media.audioMuted"]);
    const processed = harness.db.outbox[0]?.["payload"] as { data: { hlsKey: string } };
    expect(processed.data.hlsKey).toBe(`m/${id}/muted/hls/master.m3u8`);

    await handlers["media.muteAudio"]?.({ mediaId: id, claimId: "claim-2", mode: "mute" }, firstAttempt);
    expect(harness.db.eventTypes()).toHaveLength(2);

    await handlers["media.muteAudio"]?.({ mediaId: id, claimId: "claim-1", mode: "restore" }, firstAttempt);
    expect(harness.db.assets.get(id)?.["hlsKey"]).toBe(`m/${id}/hls/master.m3u8`);
    expect(harness.db.variants.filter((variant) => variant["assetId"] === id).map((variant) => variant["key"]).sort()).toEqual([`m/${id}/hls/master.m3u8`, `m/${id}/video.mp4`]);
    expect(harness.db.eventTypes()).toEqual(["media.processed", "media.audioMuted", "media.processed", "media.audioRestored"]);
  });

  it("ignores media that is not a ready video and unrelated events", async () => {
    const { harness, id } = seedReadyClip();
    harness.db.assets.get(id)!["kind"] = "image";
    await createMediaJobHandlers(harness.context)["media.muteAudio"]?.({ mediaId: id, mode: "mute" }, firstAttempt);
    expect(harness.db.eventTypes()).toEqual([]);
    await handleDomainEventForMedia(harness.context, envelope("post.created", [id]));
    expect(harness.enqueued).toHaveLength(0);
  });

  it("builds a silent soundtrack without re-encoding the picture", () => {
    const args = buildSilentSoundtrackArgs("/work/in.mp4", "/work/out.mp4");
    expect(args).toEqual(expect.arrayContaining(["anullsrc=channel_layout=stereo:sample_rate=44100", "-shortest", "/work/out.mp4"]));
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
    expect(args.slice(args.indexOf("-map"), args.indexOf("-map") + 4)).toEqual(["-map", "0:v:0", "-map", "1:a:0"]);
    expect(originalKeyForMutedKey("m/abc/muted/hls/master.m3u8")).toBe("m/abc/hls/master.m3u8");
  });
});
