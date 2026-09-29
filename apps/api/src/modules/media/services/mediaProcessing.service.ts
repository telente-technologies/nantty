import { createHash } from "node:crypto";

import { contentHashedFileKey, publicAssetPrefix, type MediaAssetRecord, type ProcessedMediaResult } from "../models/mediaAsset.model.js";
import { UnprocessableMediaError, type ImageProcessor, type VideoProcessor } from "../models/mediaProcessing.model.js";
import { isPrivatePurpose } from "../models/mediaUpload.model.js";
import { IMMUTABLE_CACHE_CONTROL, type MediaService } from "./media.service.js";
import { VideoVariantsService } from "./videoVariants.service.js";

export interface MediaProcessors {
  readonly image: ImageProcessor;
  readonly video: VideoProcessor;
}

export interface ProcessingAttempt {
  readonly attemptNumber: number;
  readonly maxAttempts: number;
  readonly signal?: AbortSignal;
}

const IMAGE_CONTENT_TYPES = { avif: "image/avif", webp: "image/webp", jpeg: "image/jpeg" } as const;
const IMAGE_EXTENSIONS = { avif: "avif", webp: "webp", jpeg: "jpg" } as const;
const GENERIC_FAILURE = "We could not process this file. Please upload it again.";
const EMPTY_RESULT: ProcessedMediaResult = { width: null, height: null, durationSeconds: null, blurhash: null, posterKey: null, hlsMasterKey: null, variants: [] };

export class MediaProcessingService {
  private readonly videoVariants: VideoVariantsService;

  public constructor(
    private readonly mediaService: MediaService,
    private readonly processors: MediaProcessors,
  ) {
    this.videoVariants = new VideoVariantsService(mediaService, processors.video, processors.image);
  }

  public async processMedia(mediaId: string, attempt: ProcessingAttempt): Promise<void> {
    const { assets, blobs, clock, logger } = this.mediaService.dependencies;
    const asset = await assets.findById(mediaId);
    if (asset === undefined || asset.status !== "processing") return;
    await assets.countProcessingAttempt(asset.id);
    try {
      const result = await this.buildVariants(asset, attempt.signal);
      if (!(await assets.markReadyIfProcessing(asset.id, result, clock.now()))) await blobs.removeAllWithPrefix(publicAssetPrefix(asset.id));
    } catch (error) {
      await blobs.removeAllWithPrefix(publicAssetPrefix(asset.id));
      if (error instanceof UnprocessableMediaError) {
        await assets.markFailedIfProcessing(asset.id, error.message);
        return;
      }
      const isFinalAttempt = attempt.attemptNumber >= attempt.maxAttempts;
      logger.error("Media processing attempt failed", { mediaId, attempt: attempt.attemptNumber, final: isFinalAttempt, error: String(error) });
      if (isFinalAttempt) await assets.markFailedIfProcessing(asset.id, GENERIC_FAILURE);
      throw error;
    }
  }

  private async buildVariants(asset: MediaAssetRecord, signal: AbortSignal | undefined): Promise<ProcessedMediaResult> {
    if (isPrivatePurpose(asset.purpose) || asset.type === "document" || asset.type === "audio") return EMPTY_RESULT;
    if (asset.type === "video") return this.videoVariants.buildVideoVariants(asset, signal);
    return this.buildImageVariants(asset);
  }

  private async buildImageVariants(asset: MediaAssetRecord): Promise<ProcessedMediaResult> {
    const { blobs } = this.mediaService.dependencies;
    const original = await blobs.read(asset.originalKey);
    if (original === undefined) throw new Error(`The original file of media ${asset.id} is missing.`);
    const processed = await this.processors.image.processImage(original.bytes);
    const variants = [];
    for (const variant of processed.variants) {
      const storageKey = contentHashedFileKey(asset.id, createHash("sha256").update(variant.bytes).digest("hex"), IMAGE_EXTENSIONS[variant.format]);
      const contentType = IMAGE_CONTENT_TYPES[variant.format];
      await blobs.write(storageKey, variant.bytes, { contentType, cacheControl: IMMUTABLE_CACHE_CONTROL });
      variants.push({ storageKey, format: variant.format, contentType, width: variant.width, height: variant.height, sizeBytes: variant.bytes.byteLength, bitrateKbps: null });
    }
    return { ...EMPTY_RESULT, width: processed.width, height: processed.height, blurhash: processed.blurhash, variants };
  }
}
