import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { convertMediaToDto, type MediaDto } from "../../dtos/media.dto.js";
import { MediaUploadedEvent } from "../../events/mediaUploaded.event.js";
import { fileContentMatchesDeclaredType } from "../../models/media.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { ConfirmUploadCommand } from "./confirmUpload.command.js";

export class ConfirmUploadHandler extends CommandHandler<ConfirmUploadCommand, MediaDto> {
  public readonly commandType = "media.confirmUpload" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: ConfirmUploadCommand): Promise<MediaDto> {
    const { media, blobs, events } = this.mediaService.dependencies;
    const record = await this.mediaService.findMediaOrThrow(command.mediaId);
    await this.mediaService.assertUploadSignatureIsValid(record, command.expiresAtSeconds, command.signature);
    if (record.status !== "pending") throw invalidState("This upload link has already been used.");
    if (command.declaredContentType?.split(";")[0]?.trim().toLowerCase() !== record.contentType) {
      throw unprocessable(`Upload the file with Content-Type ${record.contentType}.`);
    }
    if (command.bytes.byteLength === 0) throw unprocessable("The file is empty.");
    if (command.bytes.byteLength > record.maxBytes) throw unprocessable("The file is larger than allowed.");
    if (!fileContentMatchesDeclaredType(command.bytes, record.contentType)) throw unprocessable("The file content does not match its type.");
    await blobs.write(record.key, command.bytes, record.contentType);
    if (!(await media.markUploadedIfPending(record.id, command.bytes.byteLength))) throw invalidState("This upload link has already been used.");
    await publishEvent(events, MediaUploadedEvent, { mediaId: record.id, ownerId: record.ownerId, purpose: record.purpose });
    return convertMediaToDto({ ...record, status: "uploaded", size: command.bytes.byteLength }, this.mediaService.buildMediaUrl(record.id));
  }
}
