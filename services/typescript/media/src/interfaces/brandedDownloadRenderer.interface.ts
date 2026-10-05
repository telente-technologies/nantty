export interface BrandedImageInput {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly watermarkHandle: string;
}

export interface BrandedVideoInput {
  readonly inputPath: string;
  readonly workDirectory: string;
  readonly watermarkHandle: string;
  readonly stripAudio: boolean;
}

export interface BrandedRenderResult {
  readonly path: string;
  readonly contentType: string;
  readonly format: string;
  readonly sizeBytes: number;
}

export interface BrandedDownloadRenderer {
  renderBrandedImage(input: BrandedImageInput): Promise<BrandedRenderResult>;
  renderBrandedVideo(input: BrandedVideoInput): Promise<BrandedRenderResult>;
}
