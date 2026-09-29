import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { MediaService } from "../../services/media.service.js";
import type { DeleteMediaCommand } from "./deleteMedia.command.js";

export class DeleteMediaHandler extends CommandHandler<DeleteMediaCommand, void> {
  public readonly commandType = "media.deleteMedia" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: DeleteMediaCommand): Promise<void> {
    const { media, blobs } = this.mediaService.dependencies;
    const record = await media.findById(command.mediaId);
    if (record === undefined || record.ownerId !== command.principal.userId) throw notFound("Media");
    await blobs.remove(record.key);
    await media.delete(record.id);
  }
}
