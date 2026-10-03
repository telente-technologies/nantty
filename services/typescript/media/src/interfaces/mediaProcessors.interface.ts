import type { MediaPurposeName } from "../constants/purposePolicy.constant.js";

export interface ProcessedFile {
  readonly name: string;
  readonly contentType: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly bitrateKbps?: number;
  readonly isVariant: boolean;
  readonly source: { readonly buffer: Uint8Array } | { readonly path: string };
  readonly sizeBytes: number;
}

export interface ProcessedMedia {
  readonly width: number;
  readonly height: number;
  readonly durationSeconds?: number;
  readonly pageCount?: number;
  readonly blurhash?: string;
  readonly files: readonly ProcessedFile[];
  readonly posterName?: string;
  readonly hlsMasterName?: string;
  readonly moderationFrames: readonly Uint8Array[];
}

export interface ProcessingInput {
  readonly inputPath: string;
  readonly workDirectory: string;
  readonly purpose: MediaPurposeName;
  readonly maximumDurationSeconds?: number;
}

export interface ImageProcessor {
  processImage(input: ProcessingInput): Promise<ProcessedMedia>;
}

export interface MediaTranscoder {
  isAvailable(): Promise<boolean>;
  processVideo(input: ProcessingInput): Promise<ProcessedMedia>;
  processAudio(input: ProcessingInput): Promise<ProcessedMedia>;
}
