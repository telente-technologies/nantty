export type ImageVariantFormat = "avif" | "webp" | "jpeg";

export interface ProcessedImageVariant {
  readonly format: ImageVariantFormat;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
}

export interface ProcessedImage {
  readonly width: number;
  readonly height: number;
  readonly blurhash: string | null;
  readonly variants: readonly ProcessedImageVariant[];
}

export interface ImageProcessor {
  processImage(original: Uint8Array): Promise<ProcessedImage>;
  computeBlurhash(image: Uint8Array): Promise<string | null>;
}

export interface VideoProbeResult {
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
}

export interface ProcessedVideoFile {
  readonly relativePath: string;
  readonly localPath: string;
  readonly contentType: string;
}

export interface ProcessedVideoRendition {
  readonly width: number;
  readonly height: number;
  readonly bitrateKbps: number;
}

export interface ProcessedVideo {
  readonly mp4: ProcessedVideoFile & ProcessedVideoRendition;
  readonly poster: ProcessedVideoFile & { readonly width: number; readonly height: number };
  readonly hlsMasterRelativePath: string;
  readonly hlsFiles: readonly ProcessedVideoFile[];
  readonly hlsRenditions: readonly ProcessedVideoRendition[];
}

export interface VideoTranscodeRequest {
  readonly sourcePath: string;
  readonly outputDirectory: string;
  readonly probe: VideoProbeResult;
  readonly signal?: AbortSignal;
}

export interface VideoProcessor {
  probeVideo(sourcePath: string, signal?: AbortSignal): Promise<VideoProbeResult>;
  transcodeVideo(request: VideoTranscodeRequest): Promise<ProcessedVideo>;
}

export class UnprocessableMediaError extends Error {
  public override readonly name = "UnprocessableMediaError";
}

export const IMAGE_VARIANT_WIDTHS = [320, 640, 1080, 2048] as const;

export const HLS_LADDER = [
  { height: 360, videoBitrateKbps: 800, audioBitrateKbps: 96 },
  { height: 540, videoBitrateKbps: 1_600, audioBitrateKbps: 128 },
  { height: 720, videoBitrateKbps: 2_800, audioBitrateKbps: 128 },
  { height: 1080, videoBitrateKbps: 5_000, audioBitrateKbps: 160 },
] as const;
