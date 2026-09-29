import { createHash } from "node:crypto";

import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, unprocessable } from "../../../../errors/domain.error.js";
import { hashesAreEqual } from "../../../../utils/hashToken.util.js";
import { listUploadedChunkIndexes } from "../../dtos/media.dto.js";
import { chunkStorageKey, expectedChunkLength } from "../../models/mediaUpload.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { UploadChunkCommand } from "./uploadChunk.command.js";

export interface UploadedChunksDto {
  readonly uploadedChunks: readonly number[];
}

const DIFFERENT_CHUNK_MESSAGE = "A different chunk was already uploaded at this index.";

export class UploadChunkHandler extends CommandHandler<UploadChunkCommand, UploadedChunksDto> {
  public readonly commandType = "media.uploadChunk" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: UploadChunkCommand): Promise<UploadedChunksDto> {
    const { uploads, blobs } = this.mediaService.dependencies;
    const upload = await this.mediaService.findOwnedUploadOrThrow(command.uploadId, command.principal.userId);
    if (upload.status !== "uploading") throw invalidState("This upload is no longer accepting chunks.");
    if (command.chunkIndex >= upload.totalChunks) throw unprocessable(`Chunk index must be below ${upload.totalChunks}.`);
    const expectedLength = expectedChunkLength(upload, command.chunkIndex);
    if (command.bytes.byteLength !== expectedLength) throw unprocessable(`Chunk ${command.chunkIndex} must be exactly ${expectedLength} bytes.`);
    const actualSha256 = createHash("sha256").update(command.bytes).digest("hex");
    if (!hashesAreEqual(actualSha256, command.declaredSha256.toLowerCase())) throw unprocessable("The chunk does not match its X-Chunk-Sha256 hash.");

    const existing = (await uploads.listChunks(upload.id)).find((chunk) => chunk.chunkIndex === command.chunkIndex);
    if (existing !== undefined && existing.sha256 !== actualSha256) throw invalidState(DIFFERENT_CHUNK_MESSAGE);
    if (existing === undefined) {
      const storageKey = chunkStorageKey(upload.id, command.chunkIndex, actualSha256);
      await blobs.write(storageKey, command.bytes, { contentType: "application/octet-stream" });
      const stored = await uploads.addChunkUnlessPresent({ uploadId: upload.id, chunkIndex: command.chunkIndex, sizeBytes: expectedLength, sha256: actualSha256, storageKey });
      if (stored.sha256 !== actualSha256) {
        await blobs.remove(storageKey);
        throw invalidState(DIFFERENT_CHUNK_MESSAGE);
      }
    }
    return { uploadedChunks: listUploadedChunkIndexes(await uploads.listChunks(upload.id)) };
  }
}
