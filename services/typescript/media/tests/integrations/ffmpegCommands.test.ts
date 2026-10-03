import { describe, expect, it } from "vitest";

import { MediaRejectedError, ProcessorUnavailableError } from "../../src/errors/media.error.js";
import { createFfmpegMediaTranscoder } from "../../src/integrations/ffmpegMediaTranscoder.integration.js";
import { buildAudioArgs, buildHlsArgs, buildMasterPlaylist, buildMp4Args, buildProbeArgs, parseProbeOutput, selectRenditions } from "../../src/utils/ffmpegCommands.util.js";
import { testConfig } from "../fakes/pipelineHarness.js";

describe("ffmpeg command builders", () => {
  it("never upscales and always offers at least the lowest rung", () => {
    expect(selectRenditions(1080, 720).map((rung) => rung.height)).toEqual([240, 480, 720]);
    expect(selectRenditions(1080, 1080).map((rung) => rung.height)).toEqual([240, 480, 720, 1080]);
    expect(selectRenditions(360, 720).map((rung) => rung.height)).toEqual([240]);
    expect(selectRenditions(144, 720).map((rung) => rung.height)).toEqual([240]);
  });

  it("strips metadata, forbids network protocols and uses h264 and aac", () => {
    const rung = { height: 720, videoBitrateKbps: 2000, audioBitrateKbps: 128 };
    for (const args of [buildMp4Args("/in", "/out.mp4", rung), buildHlsArgs("/in", "/dir", rung)]) {
      expect(args.slice(args.indexOf("-protocol_whitelist"), args.indexOf("-protocol_whitelist") + 2)).toEqual(["-protocol_whitelist", "file"]);
      expect(args).toEqual(expect.arrayContaining(["-map_metadata", "-1", "libx264", "aac"]));
      expect(args.join(" ")).toContain("scale=-2:min(ih\\,720)");
    }
    expect(buildHlsArgs("/in", "/dir", rung)).toEqual(expect.arrayContaining(["-hls_playlist_type", "vod", "/dir/index.m3u8"]));
    expect(buildAudioArgs("/in", "/out.m4a")).toEqual(expect.arrayContaining(["-vn", "-map_metadata", "-1"]));
    expect(buildProbeArgs("/in")).toContain("-show_streams");
  });

  it("writes a master playlist with one stream per rendition", () => {
    const playlist = buildMasterPlaylist([{ width: 426, height: 240, bandwidthKbps: 464, uri: "240p/index.m3u8" }, { width: 1280, height: 720, bandwidthKbps: 2128, uri: "720p/index.m3u8" }]);
    expect(playlist.startsWith("#EXTM3U")).toBe(true);
    expect(playlist).toContain("BANDWIDTH=464000,RESOLUTION=426x240");
    expect(playlist).toContain("720p/index.m3u8");
  });

  it("parses probe output including rotation", () => {
    const summary = parseProbeOutput(JSON.stringify({ format: { duration: "12.5" }, streams: [{ codec_type: "video", width: 1920, height: 1080, tags: { rotate: "90" } }, { codec_type: "audio" }] }));
    expect(summary).toEqual({ width: 1080, height: 1920, durationSeconds: 12.5, hasVideo: true, hasAudio: true });
  });
});

describe("ffmpeg transcoder availability", () => {
  const ffmpeg = testConfig().ffmpeg;
  const input = { inputPath: "/in", workDirectory: "/tmp/none", purpose: "clip" as const };

  it("reports unavailable and refuses to process when ffmpeg cannot run", async () => {
    const transcoder = createFfmpegMediaTranscoder({ config: ffmpeg, run: async () => { throw new Error("ENOENT"); } });
    expect(await transcoder.isAvailable()).toBe(false);
    await expect(transcoder.processVideo(input)).rejects.toBeInstanceOf(ProcessorUnavailableError);
    await expect(transcoder.processAudio(input)).rejects.toBeInstanceOf(ProcessorUnavailableError);
  });

  it("is disabled by configuration without probing", async () => {
    let calls = 0;
    const transcoder = createFfmpegMediaTranscoder({ config: { ...ffmpeg, mode: "disabled" }, run: async () => { calls += 1; return ""; } });
    expect(await transcoder.isAvailable()).toBe(false);
    expect(calls).toBe(0);
  });

  it("rejects files without a video stream or over the duration limit", async () => {
    const audioOnly = JSON.stringify({ format: { duration: "5" }, streams: [{ codec_type: "audio" }] });
    const tooLong = JSON.stringify({ format: { duration: "999" }, streams: [{ codec_type: "video", width: 640, height: 480 }] });
    for (const [probe, options, reason] of [[audioOnly, input, "NO_VIDEO_STREAM"], [tooLong, { ...input, maximumDurationSeconds: 180 }, "DURATION_EXCEEDED"]] as const) {
      const transcoder = createFfmpegMediaTranscoder({ config: ffmpeg, run: async (command) => (command === ffmpeg.ffprobePath ? probe : "") });
      await expect(transcoder.processVideo(options)).rejects.toEqual(new MediaRejectedError(reason));
    }
  });
});
