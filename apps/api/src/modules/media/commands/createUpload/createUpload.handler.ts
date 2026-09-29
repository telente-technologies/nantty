import { randomUUID } from "node:crypto";

import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { UploadSessionCreatedDto } from "../../dtos/media.dto.js";
import { countChunksForFile, purposeAllowsMimeType } from "../../models/mediaUpload.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { CreateUploadCommand } from "./createUpload.command.js";

export class CreateUploadHandler extends CommandHandler<CreateUploadCommand, UploadSessionCreatedDto> {
  public readonly commandType = "media.createUpload" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: CreateUploadCommand): Promise<UploadSessionCreatedDto> {
    const { uploads, settings, clock } = this.mediaService.dependencies;
    const { purpose, mimeType, sizeBytes, fileName, sha256 } = command.input;
    if (!purposeAllowsMimeType(purpose, mimeType)) throw unprocessable(`A ${purpose} upload cannot be a ${mimeType} file.`);
    const maximumBytes = this.mediaService.maximumBytesFor(purpose, mimeType);
    if (sizeBytes > maximumBytes) throw unprocessable(`The file is larger than the ${maximumBytes} bytes allowed for a ${purpose} upload.`);
    const chunkSizeBytes = Math.min(settings.chunkSizeBytes, sizeBytes);
    const upload = await uploads.create({
      id: randomUUID(),
      ownerId: command.principal.userId,
      fileName: fileName.trim(),
      mimeType,
      purpose,
      sizeBytes,
      chunkSizeBytes,
      totalChunks: countChunksForFile(sizeBytes, chunkSizeBytes),
      expectedSha256: sha256?.toLowerCase() ?? null,
      createdAt: clock.now(),
    });
    return { uploadId: upload.id, chunkSizeBytes: upload.chunkSizeBytes, totalChunks: upload.totalChunks, uploadedChunks: [] };
  }
}
