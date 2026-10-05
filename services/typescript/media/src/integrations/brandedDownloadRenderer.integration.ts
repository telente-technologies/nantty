import { stat } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import type { MediaConfig } from "../configs/media.config.js";
import { maximumInputPixels } from "../constants/media.constant.js";
import { MediaRejectedError, ProcessorUnavailableError } from "../errors/media.error.js";
import type { BrandedDownloadRenderer, BrandedImageInput, BrandedRenderResult, BrandedVideoInput } from "../interfaces/brandedDownloadRenderer.interface.js";
import { buildBrandWatermarkSvg, buildEndCardLogoSvg, buildEndCardSymbolHalfSvg, computeEndCardLogoSize, computeEndCardWordmarkPlacement, computeWatermarkBox, computeWatermarkWordmarkPlacement, type EndCardSize, type WatermarkBox } from "../utils/brandWatermark.util.js";
import { buildBrandedVideoArgs, evenDimension } from "../utils/brandedVideoCommands.util.js";
import { buildProbeArgs, parseProbeOutput } from "../utils/ffmpegCommands.util.js";
import { getWordmarkRaster, warmBrandWordmarkAssets, withOpacity } from "./brandWordmarkAssets.integration.js";
import { runCommandWithoutShell, type CommandRunner } from "./ffmpegMediaTranscoder.integration.js";

const imageWatermarkHeightRatio = 0.06;
const videoWatermarkHeightRatio = 0.075;

export async function composeWatermarkPng(box: WatermarkBox, handle: string, opacity: number): Promise<Buffer> {
  const placement = computeWatermarkWordmarkPlacement(box, handle);
  const wordmark = await getWordmarkRaster(placement.height, "badge");
  const left = Math.max(0, Math.min(box.width - wordmark.width, placement.left - wordmark.bleed));
  const top = Math.max(0, placement.top - wordmark.bleed);
  return sharp(Buffer.from(buildBrandWatermarkSvg(box, handle, opacity)))
    .composite([{ input: await withOpacity(wordmark.png, opacity), left, top }])
    .png()
    .toBuffer();
}

export async function composeEndCardLogoPng(size: EndCardSize, handle: string): Promise<Buffer> {
  const placement = computeEndCardWordmarkPlacement(size);
  const wordmark = await getWordmarkRaster(placement.height, "endCard");
  return sharp(Buffer.from(buildEndCardLogoSvg(size, handle)))
    .composite([{ input: wordmark.png, left: Math.max(0, Math.round((size.width - wordmark.width) / 2)), top: placement.top }])
    .png()
    .toBuffer();
}

export async function renderBrandedImageWithSharp(input: BrandedImageInput): Promise<BrandedRenderResult> {
  const source = sharp(input.inputPath, { limitInputPixels: maximumInputPixels }).rotate();
  const metadata = await source.metadata();
  const oriented = (metadata.orientation ?? 1) >= 5;
  const width = (oriented ? metadata.height : metadata.width) ?? 0;
  const height = (oriented ? metadata.width : metadata.height) ?? 0;
  if (width === 0 || height === 0) throw new MediaRejectedError("NO_IMAGE_DIMENSIONS");
  const box = computeWatermarkBox(width, height, input.watermarkHandle, imageWatermarkHeightRatio);
  const overlay = await composeWatermarkPng(box, input.watermarkHandle, 0.72);
  await source
    .composite([{ input: overlay, left: Math.max(0, width - box.width - box.margin), top: Math.max(0, height - box.height - box.margin) }])
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toFile(input.outputPath);
  return { path: input.outputPath, contentType: "image/jpeg", format: "jpg", sizeBytes: (await stat(input.outputPath)).size };
}

export function createBrandedDownloadRenderer(options: { readonly config: MediaConfig["ffmpeg"]; readonly run?: CommandRunner }): BrandedDownloadRenderer {
  const { config } = options;
  const run = options.run ?? runCommandWithoutShell;
  void warmBrandWordmarkAssets().catch(() => undefined);
  return {
    renderBrandedImage: renderBrandedImageWithSharp,
    async renderBrandedVideo(input: BrandedVideoInput): Promise<BrandedRenderResult> {
      if (config.mode === "disabled") throw new ProcessorUnavailableError("ffmpeg is disabled on this worker.");
      const probe = parseProbeOutput(await run(config.ffprobePath, buildProbeArgs(input.inputPath), 60_000));
      if (!probe.hasVideo || probe.width === 0 || probe.height === 0 || probe.durationSeconds <= 0) throw new MediaRejectedError("NO_VIDEO_STREAM");
      const width = evenDimension(probe.width);
      const height = evenDimension(probe.height);
      const box = computeWatermarkBox(width, height, input.watermarkHandle, videoWatermarkHeightRatio);
      const watermarkPngPath = join(input.workDirectory, "watermark.png");
      const endCardLogoPngPath = join(input.workDirectory, "endCardLogo.png");
      await sharp(await composeWatermarkPng(box, input.watermarkHandle, 0.78)).toFile(watermarkPngPath);
      const endCardSize = computeEndCardLogoSize(width, height);
      const endCardSymbolLeftPngPath = join(input.workDirectory, "endCardSymbolLeft.png");
      const endCardSymbolRightPngPath = join(input.workDirectory, "endCardSymbolRight.png");
      await sharp(await composeEndCardLogoPng(endCardSize, input.watermarkHandle)).toFile(endCardLogoPngPath);
      await sharp(Buffer.from(buildEndCardSymbolHalfSvg(endCardSize, "left"))).png().toFile(endCardSymbolLeftPngPath);
      await sharp(Buffer.from(buildEndCardSymbolHalfSvg(endCardSize, "right"))).png().toFile(endCardSymbolRightPngPath);
      const outputPath = join(input.workDirectory, "download.mp4");
      await run(config.ffmpegPath, buildBrandedVideoArgs({
        inputPath: input.inputPath, watermarkPngPath, endCardLogoPngPath, endCardSymbolLeftPngPath, endCardSymbolRightPngPath, outputPath, width, height,
        durationSeconds: probe.durationSeconds, margin: box.margin, keepSourceAudio: probe.hasAudio && !input.stripAudio,
      }), config.timeoutMs);
      return { path: outputPath, contentType: "video/mp4", format: "mp4", sizeBytes: (await stat(outputPath)).size };
    },
  };
}
