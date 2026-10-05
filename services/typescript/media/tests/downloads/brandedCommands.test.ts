import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createBrandedDownloadRenderer, renderBrandedImageWithSharp } from "../../src/integrations/brandedDownloadRenderer.integration.js";
import { buildBrandWatermarkSvg, computeWatermarkBox, normalizeWatermarkHandle } from "../../src/utils/brandWatermark.util.js";
import { buildBrandedVideoArgs, buildBrandedVideoFilterGraph, buildWatermarkCornerExpressions, endCardDurationSeconds } from "../../src/utils/brandedVideoCommands.util.js";
import { testConfig } from "../fakes/pipelineHarness.js";

const plan = { inputPath: "/in.mp4", watermarkPngPath: "/wm.png", endCardLogoPngPath: "/card.png", endCardSymbolLeftPngPath: "/left.png", endCardSymbolRightPngPath: "/right.png", outputPath: "/out.mp4", width: 720, height: 1280, durationSeconds: 9.5, margin: 20, keepSourceAudio: true };

describe("watermark layout", () => {
  it("accepts only real usernames", () => {
    expect(normalizeWatermarkHandle("@Ada.Lovelace_")).toBe("ada.lovelace_");
    expect(normalizeWatermarkHandle("<script>")).toBeUndefined();
    expect(normalizeWatermarkHandle("a".repeat(31))).toBeUndefined();
  });

  it("scales the watermark with the frame and keeps it subtle", () => {
    const small = computeWatermarkBox(320, 240, "ada", 0.06);
    const large = computeWatermarkBox(3000, 2000, "ada", 0.06);
    expect(large.height).toBeGreaterThan(small.height);
    expect(large.height).toBeLessThanOrEqual(120);
    expect(small.width).toBeLessThanOrEqual(320 * 0.6);
    expect(buildBrandWatermarkSvg(small, "ada", 0.72)).toContain('opacity="0.72"');
  });
});

describe("branded video command", () => {
  it("cycles the watermark through all four corners", () => {
    const { x, y } = buildWatermarkCornerExpressions(16, 4);
    expect(x).toContain("mod(floor(t/4),4)");
    expect(x).toContain("W-w-16");
    expect(y).toContain("H-h-16");
  });

  it("appends an animated end card and keeps audio when allowed", () => {
    const graph = buildBrandedVideoFilterGraph(plan);
    expect(graph).toContain("[0:a:0]");
    expect(graph).toContain("concat=n=2:v=1:a=1");
    expect(graph).toContain("fade=t=in");
    expect(graph).toContain(`d=${endCardDurationSeconds}`);
    const args = buildBrandedVideoArgs(plan);
    expect(args.slice(args.indexOf("-protocol_whitelist"), args.indexOf("-protocol_whitelist") + 2)).toEqual(["-protocol_whitelist", "file"]);
    expect(args).toEqual(expect.arrayContaining(["-map_metadata", "-1", "libx264", "aac", "+faststart"]));
    expect(args.filter((arg) => arg === "-i")).toHaveLength(6);
    expect(graph).toContain("sin(t*16)");
  });

  it("never reads source audio when the clip must stay silent", () => {
    const silent = { ...plan, keepSourceAudio: false };
    expect(buildBrandedVideoFilterGraph(silent)).not.toContain("[0:a");
    expect(buildBrandedVideoArgs(silent).filter((arg) => arg === "-i")).toHaveLength(7);
  });
});

describe("branded renderer", () => {
  it("stamps a semi-transparent badge into the bottom-right of an image without resizing it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "branded-test-"));
    try {
      const inputPath = join(directory, "in.jpg");
      await sharp({ create: { width: 320, height: 240, channels: 3, background: "#808080" } }).jpeg().toFile(inputPath);
      const result = await renderBrandedImageWithSharp({ inputPath, outputPath: join(directory, "out.jpg"), watermarkHandle: "ada" });
      const { data, info } = await sharp(result.path).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([320, 240]);
      const box = computeWatermarkBox(320, 240, "ada", 0.06);
      const badgePixel = ((240 - box.margin - box.height / 2) * 320 + (320 - box.width - box.margin + 10)) * info.channels;
      const cornerPixel = (5 * 320 + 5) * info.channels;
      expect(Math.abs((data[badgePixel] ?? 0) - (data[cornerPixel] ?? 0)) + Math.abs((data[badgePixel + 2] ?? 0) - (data[cornerPixel + 2] ?? 0))).toBeGreaterThan(20);
      expect(result.contentType).toBe("image/jpeg");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("probes, then runs ffmpeg with a silent soundtrack for stripped clips", async () => {
    const calls: { command: string; args: readonly string[] }[] = [];
    const directory = await mkdtemp(join(tmpdir(), "branded-video-"));
    try {
      const renderer = createBrandedDownloadRenderer({
        config: testConfig().ffmpeg,
        run: async (command, args) => {
          calls.push({ command, args });
          if (command.includes("ffprobe")) return JSON.stringify({ format: { duration: "6" }, streams: [{ codec_type: "video", width: 721, height: 1281 }, { codec_type: "audio" }] });
          await writeFile(args.at(-1) as string, "mp4");
          return "";
        },
      });
      const result = await renderer.renderBrandedVideo({ inputPath: "/in.mp4", workDirectory: directory, watermarkHandle: "ada", stripAudio: true });
      const ffmpegArgs = calls[1]?.args ?? [];
      expect(ffmpegArgs.join(" ")).toContain("scale=720:1280");
      expect(ffmpegArgs.join(" ")).not.toContain("[0:a");
      expect(result).toMatchObject({ contentType: "video/mp4", sizeBytes: 3 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
