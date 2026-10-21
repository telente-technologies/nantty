import { randomUUID } from "node:crypto";

import { loadMediaConfigFromEnvironment, type MediaConfig } from "../../src/configs/media.config.js";
import type { MalwareScanner } from "../../src/interfaces/malwareScanner.interface.js";
import type { ImageProcessor, MediaTranscoder } from "../../src/interfaces/mediaProcessors.interface.js";
import type { BrandedDownloadRenderer } from "../../src/interfaces/brandedDownloadRenderer.interface.js";
import type { ModerationClient } from "../../src/interfaces/moderationClient.interface.js";
import { createSharpImageProcessor } from "../../src/integrations/sharpImageProcessor.integration.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import type { JobAttempt } from "../../src/interfaces/jobQueue.interface.js";
import { FakeMediaDatabase } from "./fakeMediaDatabase.js";
import { FakeObjectStorage } from "./fakeObjectStorage.js";

export const firstAttempt: JobAttempt = { attempt: 1, maximumAttempts: 5, isFinalAttempt: false };
export const finalAttempt: JobAttempt = { attempt: 5, maximumAttempts: 5, isFinalAttempt: true };

export function testConfig(overrides: Partial<MediaConfig> = {}): MediaConfig {
  process.env["DATABASE_URL"] = "postgres://test:test@localhost:5432/test?schema=media";
  process.env["GATEWAY_IDENTITY_SECRET"] ??= "test-gateway-identity-secret-0123456789abcdef";
  return { ...loadMediaConfigFromEnvironment(), ...overrides };
}

export const unavailableTranscoder: MediaTranscoder = {
  isAvailable: async () => false,
  processVideo: async () => { throw new (await import("../../src/errors/media.error.js")).ProcessorUnavailableError("no ffmpeg"); },
  processAudio: async () => { throw new (await import("../../src/errors/media.error.js")).ProcessorUnavailableError("no ffmpeg"); },
  muteVideoAudio: async () => { throw new (await import("../../src/errors/media.error.js")).ProcessorUnavailableError("no ffmpeg"); },
  computeAudioFingerprint: async () => null,
};

export const unavailableBranding: BrandedDownloadRenderer = {
  renderBrandedImage: async () => { throw new (await import("../../src/errors/media.error.js")).ProcessorUnavailableError("no renderer"); },
  renderBrandedVideo: async () => { throw new (await import("../../src/errors/media.error.js")).ProcessorUnavailableError("no ffmpeg"); },
};

export interface Harness {
  readonly context: HandlerContext;
  readonly db: FakeMediaDatabase;
  readonly storage: FakeObjectStorage;
  readonly enqueued: { queue: string; job: { id: string; type: string; payload: Record<string, unknown> } }[];
  clock: { now: () => Date; current: Date };
  seedUpload(options: { purpose: string; mimeType: string; bytes: Uint8Array; kind?: string; isPrivate?: boolean; sha256?: string | null; expiresAt?: Date | null }): string;
}

export function createHarness(options: { scanner?: MalwareScanner; moderation?: ModerationClient; images?: ImageProcessor; transcoder?: MediaTranscoder; branding?: BrandedDownloadRenderer; config?: Partial<MediaConfig> } = {}): Harness {
  const db = new FakeMediaDatabase();
  const storage = new FakeObjectStorage();
  const enqueued: Harness["enqueued"] = [];
  const clock = { current: new Date("2026-10-03T12:00:00Z"), now() { return this.current; } };
  const config = testConfig(options.config);
  const context: HandlerContext = {
    config, database: db.database, storage, clock,
    urls: { publicUrl: (key) => `https://cdn.test/${key}`, privateUrl: async (bucket, key, expires) => `https://private.test/${bucket}/${key}?e=${expires}` },
    jobs: { enqueueJob: async (queue, job) => { enqueued.push({ queue, job: job as never }); } },
    scanner: options.scanner ?? { scanFile: async () => ({ verdict: "clean" }) },
    moderation: options.moderation ?? { classify: async () => ({ score: 0, topCategory: null }) },
    images: options.images ?? createSharpImageProcessor(),
    transcoder: options.transcoder ?? unavailableTranscoder,
    branding: options.branding ?? unavailableBranding,
  };
  return {
    context, db, storage, enqueued, clock,
    seedUpload({ purpose, mimeType, bytes, kind = "image", isPrivate = false, sha256 = null, expiresAt = null }) {
      const id = randomUUID();
      const ownerId = randomUUID();
      const quarantineKey = `${ownerId}/${id}/original`;
      storage.seed(config.storage.quarantineBucket, quarantineKey, bytes);
      db.insertAsset({ id, ownerId, purpose, kind, isPrivate, status: "uploaded", declaredMimeType: mimeType, sizeBytes: BigInt(bytes.byteLength), sha256, quarantineBucket: config.storage.quarantineBucket, quarantineKey, expiresAt });
      return id;
    },
  };
}
