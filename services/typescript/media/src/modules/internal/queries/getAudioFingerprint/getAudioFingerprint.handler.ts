import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { notFound } from "../../../../errors/media.error.js";
import type { AudioFingerprint } from "../../../../interfaces/mediaProcessors.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";

export interface AudioFingerprintView {
  readonly mediaId: string;
  readonly available: boolean;
  readonly fingerprint: AudioFingerprint | null;
}

const fingerprintableFormats = ["m4a", "mp4"];

export function createGetAudioFingerprintHandler(context: HandlerContext): Handler<{ readonly mediaId: string }, AudioFingerprintView> {
  return async ({ mediaId }) => {
    const asset = await mediaAssetRepository.findById(context.database.client, mediaId);
    if (asset === null || asset.status !== "ready") throw notFound("MEDIA_NOT_FOUND", "Media not found");
    const source = asset.variants.find((variant) => fingerprintableFormats.includes(variant.format) && !variant.key.includes("/muted/"));
    if (source === undefined || (asset.kind !== "video" && asset.kind !== "audio")) return { mediaId, available: false, fingerprint: null };
    const workDirectory = await mkdtemp(join(tmpdir(), "zudomart-fingerprint-"));
    try {
      const inputPath = join(workDirectory, `source.${source.format}`);
      await context.storage.downloadToFile(source.bucket, source.key, inputPath);
      const fingerprint = await context.transcoder.computeAudioFingerprint(inputPath);
      return { mediaId, available: fingerprint !== null, fingerprint };
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  };
}
