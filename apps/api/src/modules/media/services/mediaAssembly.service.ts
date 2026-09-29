import { createHash, randomUUID } from "node:crypto";

import { invalidState, unprocessable } from "../../../errors/domain.error.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { hashesAreEqual } from "../../../utils/hashToken.util.js";
import type { UploadCompletedDto } from "../dtos/media.dto.js";
import { MediaUploadedEvent } from "../events/mediaUploaded.event.js";
import { fileHeaderMatchesMimeType } from "../models/fileSignature.model.js";
import { mediaTypeForMimeType, originalStorageKey, type UploadChunkRecord, type UploadSessionRecord } from "../models/mediaUpload.model.js";
import type { MediaService } from "./media.service.js";

export interface MediaProcessingScheduler {
  enqueueProcessing(mediaId: string): Promise<void>;
}

class UploadRejectedError extends Error {}

export class MediaAssemblyService {
  public constructor(
    private readonly mediaService: MediaService,
    private readonly processingScheduler: MediaProcessingScheduler,
  ) {}

  public async completeUpload(upload: UploadSessionRecord): Promise<UploadCompletedDto> {
    const { uploads } = this.mediaService.dependencies;
    if (upload.status === "completed" && upload.mediaId !== null) return this.describeCompletedUpload(upload.mediaId);
    if (upload.status === "failed") throw invalidState(`This upload failed: ${upload.failureReason ?? "unknown reason"}.`);
    if (upload.status === "assembling") throw invalidState("This upload is already being completed.");
    const chunks = await uploads.listChunks(upload.id);
    const present = new Set(chunks.map((chunk) => chunk.chunkIndex));
    const missing = Array.from({ length: upload.totalChunks }, (_unused, index) => index).filter((index) => !present.has(index));
    if (missing.length > 0) throw invalidState(`The upload is missing chunks: ${missing.slice(0, 20).join(", ")}.`);
    if (!(await uploads.changeStatusIfCurrent(upload.id, ["uploading"], "assembling"))) throw invalidState("This upload is already being completed.");

    const mediaId = randomUUID();
    let sha256: string;
    try {
      sha256 = await this.assembleOriginal(upload, chunks, mediaId);
    } catch (error) {
      if (error instanceof UploadRejectedError) {
        await uploads.changeStatusIfCurrent(upload.id, ["assembling"], "failed", { failureReason: error.message });
        throw unprocessable(error.message);
      }
      await uploads.changeStatusIfCurrent(upload.id, ["assembling"], "uploading");
      throw error;
    }
    return this.registerAssembledMedia(upload, chunks, mediaId, sha256);
  }

  private async assembleOriginal(upload: UploadSessionRecord, chunks: readonly UploadChunkRecord[], mediaId: string): Promise<string> {
    const { blobs } = this.mediaService.dependencies;
    const firstChunk = await blobs.read(chunks[0]?.storageKey ?? "");
    if (firstChunk === undefined) throw new Error(`Chunk 0 of upload ${upload.id} is missing from storage.`);
    if (!fileHeaderMatchesMimeType(firstChunk.bytes.subarray(0, 64), upload.mimeType)) {
      throw new UploadRejectedError(`The file content is not a valid ${upload.mimeType} file.`);
    }
    const wholeFileHash = createHash("sha256");
    let assembledBytes = 0;
    let nextChunk = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull: async (controller) => {
        const chunk = chunks[nextChunk];
        nextChunk += 1;
        if (chunk === undefined) return controller.close();
        const blob = await blobs.read(chunk.storageKey);
        if (blob === undefined) return controller.error(new Error(`Chunk ${chunk.chunkIndex} of upload ${upload.id} is missing from storage.`));
        wholeFileHash.update(blob.bytes);
        assembledBytes += blob.bytes.byteLength;
        controller.enqueue(blob.bytes);
      },
    });
    const originalKey = originalStorageKey(mediaId);
    await blobs.writeStream(originalKey, stream, { contentType: upload.mimeType, cacheControl: "private, no-store" });
    const actualSha256 = wholeFileHash.digest("hex");
    const sizeMatches = assembledBytes === upload.sizeBytes;
    const hashMatches = upload.expectedSha256 === null || hashesAreEqual(actualSha256, upload.expectedSha256);
    if (!sizeMatches || !hashMatches) {
      await blobs.remove(originalKey);
      throw new UploadRejectedError(sizeMatches ? "The assembled file does not match its sha256 hash." : "The assembled file has the wrong size.");
    }
    return actualSha256;
  }

  private async registerAssembledMedia(upload: UploadSessionRecord, chunks: readonly UploadChunkRecord[], mediaId: string, sha256: string): Promise<UploadCompletedDto> {
    const { uploads, assets, blobs, clock, events } = this.mediaService.dependencies;
    await assets.create({
      id: mediaId,
      ownerId: upload.ownerId,
      purpose: upload.purpose,
      type: mediaTypeForMimeType(upload.mimeType),
      mimeType: upload.mimeType,
      originalKey: originalStorageKey(mediaId),
      sizeBytes: upload.sizeBytes,
      sha256,
      createdAt: clock.now(),
    });
    await uploads.changeStatusIfCurrent(upload.id, ["assembling"], "completed", { mediaId });
    for (const chunk of chunks) await blobs.remove(chunk.storageKey);
    await this.processingScheduler.enqueueProcessing(mediaId);
    await publishEvent(events, MediaUploadedEvent, { mediaId, ownerId: upload.ownerId, purpose: upload.purpose });
    return { mediaId, status: "processing" };
  }

  private async describeCompletedUpload(mediaId: string): Promise<UploadCompletedDto> {
    const asset = await this.mediaService.dependencies.assets.findById(mediaId);
    return { mediaId, status: asset?.status ?? "failed" };
  }
}
