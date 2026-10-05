import type { MediaConfig } from "../configs/media.config.js";
import type { BrandedDownloadRenderer } from "../interfaces/brandedDownloadRenderer.interface.js";
import type { MediaDatabase } from "../databases/prisma.database.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { JobQueue } from "../interfaces/jobQueue.interface.js";
import type { MalwareScanner } from "../interfaces/malwareScanner.interface.js";
import type { ImageProcessor, MediaTranscoder } from "../interfaces/mediaProcessors.interface.js";
import type { MediaUrlSigner } from "../interfaces/mediaUrlSigner.interface.js";
import type { ModerationClient } from "../interfaces/moderationClient.interface.js";
import type { ObjectStorage } from "../interfaces/objectStorage.interface.js";

export interface HandlerContext {
  readonly config: MediaConfig;
  readonly database: MediaDatabase;
  readonly storage: ObjectStorage;
  readonly urls: MediaUrlSigner;
  readonly jobs: JobQueue;
  readonly clock: Clock;
  readonly scanner: MalwareScanner;
  readonly moderation: ModerationClient | undefined;
  readonly images: ImageProcessor;
  readonly transcoder: MediaTranscoder;
  readonly branding: BrandedDownloadRenderer;
}

export type Handler<TInput, TResult> = (input: TInput) => Promise<TResult>;
