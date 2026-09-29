import { randomUUID } from "node:crypto";

import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { UploadInstructionsDto } from "../../dtos/media.dto.js";
import { purposeAllowsContentType } from "../../models/media.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { CreateUploadUrlCommand } from "./createUploadUrl.command.js";

export class CreateUploadUrlHandler extends CommandHandler<CreateUploadUrlCommand, UploadInstructionsDto> {
  public readonly commandType = "media.createUploadUrl" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: CreateUploadUrlCommand): Promise<UploadInstructionsDto> {
    const { media, settings, clock } = this.mediaService.dependencies;
    const { purpose, contentType, size } = command.input;
    if (!purposeAllowsContentType(purpose, contentType)) throw unprocessable(`A ${purpose} cannot be a ${contentType} file.`);
    const maximumBytes = this.mediaService.maximumBytesFor(contentType);
    if (size !== undefined && size > maximumBytes) throw unprocessable("The file is larger than allowed.");
    const id = randomUUID();
    const record = await media.create({ id, ownerId: command.principal.userId, key: `media/${command.principal.userId}/${id}`, purpose, contentType, maxBytes: size ?? maximumBytes });
    const expiresAtSeconds = Math.floor(clock.now().getTime() / 1000) + settings.urlTtlSeconds;
    return {
      mediaId: record.id,
      uploadUrl: await this.mediaService.buildSignedUploadUrl(record, expiresAtSeconds),
      method: "PUT",
      headers: { "content-type": contentType },
      maxBytes: record.maxBytes,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      url: this.mediaService.buildMediaUrl(record.id),
      fileUrl: this.mediaService.buildMediaUrl(record.id),
    };
  }
}
