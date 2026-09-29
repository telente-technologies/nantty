import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contentHashedFileKey, publicAssetPrefix, type MediaAssetRecord, type NewMediaVariantInput, type ProcessedMediaResult } from "../models/mediaAsset.model.js";
import { UnprocessableMediaError, type ImageProcessor, type ProcessedVideo, type VideoProcessor } from "../models/mediaProcessing.model.js";
import { IMMUTABLE_CACHE_CONTROL, type MediaService } from "./media.service.js";

const SAFE_RELATIVE_PATH = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(m3u8|ts)$/;

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class VideoVariantsService {
  public constructor(
    private readonly mediaService: MediaService,
    private readonly videoProcessor: VideoProcessor,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  public async buildVideoVariants(asset: MediaAssetRecord, signal?: AbortSignal): Promise<ProcessedMediaResult> {
    const { blobs } = this.mediaService.dependencies;
    const workDirectory = await mkdtemp(join(tmpdir(), "zudomart-media-"));
    try {
      const original = await blobs.read(asset.originalKey);
      if (original === undefined) throw new Error(`The original file of media ${asset.id} is missing.`);
      const sourcePath = join(workDirectory, "source");
      await writeFile(sourcePath, original.bytes);
      const probe = await this.videoProcessor.probeVideo(sourcePath, signal);
      const maximumSeconds = this.mediaService.maximumVideoSecondsFor(asset.purpose);
      if (probe.durationSeconds > maximumSeconds) {
        throw new UnprocessableMediaError(`Videos for a ${asset.purpose} can be at most ${maximumSeconds} seconds long.`);
      }
      const outputDirectory = join(workDirectory, "output");
      await mkdir(outputDirectory, { recursive: true });
      const processed = await this.videoProcessor.transcodeVideo({ sourcePath, outputDirectory, probe, ...(signal === undefined ? {} : { signal }) });
      return await this.publishVideoOutputs(asset, processed, probe.durationSeconds);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  }

  private async publishVideoOutputs(asset: MediaAssetRecord, processed: ProcessedVideo, durationSeconds: number): Promise<ProcessedMediaResult> {
    const { blobs } = this.mediaService.dependencies;
    const mp4Bytes = new Uint8Array(await readFile(processed.mp4.localPath));
    const mp4Key = contentHashedFileKey(asset.id, sha256Hex(mp4Bytes), "mp4");
    await blobs.write(mp4Key, mp4Bytes, { contentType: "video/mp4", cacheControl: IMMUTABLE_CACHE_CONTROL });
    const posterBytes = new Uint8Array(await readFile(processed.poster.localPath));
    const posterKey = contentHashedFileKey(asset.id, sha256Hex(posterBytes), "jpg");
    await blobs.write(posterKey, posterBytes, { contentType: "image/jpeg", cacheControl: IMMUTABLE_CACHE_CONTROL });
    const hlsMasterKey = await this.publishHlsFiles(asset.id, processed);
    const topRendition = processed.hlsRenditions[processed.hlsRenditions.length - 1];
    const variants: NewMediaVariantInput[] = [
      { storageKey: mp4Key, format: "mp4", contentType: "video/mp4", width: processed.mp4.width, height: processed.mp4.height, sizeBytes: mp4Bytes.byteLength, bitrateKbps: processed.mp4.bitrateKbps },
      {
        storageKey: hlsMasterKey,
        format: "hls",
        contentType: "application/vnd.apple.mpegurl",
        width: topRendition?.width ?? processed.mp4.width,
        height: topRendition?.height ?? processed.mp4.height,
        sizeBytes: 0,
        bitrateKbps: topRendition?.bitrateKbps ?? null,
      },
    ];
    return {
      width: processed.mp4.width,
      height: processed.mp4.height,
      durationSeconds,
      blurhash: await this.imageProcessor.computeBlurhash(posterBytes),
      posterKey,
      hlsMasterKey,
      variants,
    };
  }

  private async publishHlsFiles(mediaId: string, processed: ProcessedVideo): Promise<string> {
    const files = [...processed.hlsFiles].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const manifest = createHash("sha256");
    for (const file of files) {
      if (!SAFE_RELATIVE_PATH.test(file.relativePath)) throw new Error(`Unexpected HLS output path ${file.relativePath}.`);
      manifest.update(`${file.relativePath}:${sha256Hex(await readFile(file.localPath))}\n`);
    }
    const prefix = `${publicAssetPrefix(mediaId)}hls-${manifest.digest("hex").slice(0, 32)}/`;
    for (const file of files) {
      const bytes = new Uint8Array(await readFile(file.localPath));
      await this.mediaService.dependencies.blobs.write(`${prefix}${file.relativePath}`, bytes, { contentType: file.contentType, cacheControl: IMMUTABLE_CACHE_CONTROL });
    }
    if (!files.some((file) => file.relativePath === processed.hlsMasterRelativePath)) throw new Error("The HLS master playlist was not produced.");
    return `${prefix}${processed.hlsMasterRelativePath}`;
  }
}
