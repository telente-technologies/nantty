import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { publicAssetPrefix } from "../../models/mediaAsset.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { DeleteMediaCommand } from "./deleteMedia.command.js";

export class DeleteMediaHandler extends CommandHandler<DeleteMediaCommand, void> {
  public readonly commandType = "media.deleteMedia" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(command: DeleteMediaCommand): Promise<void> {
    const { assets, blobs } = this.mediaService.dependencies;
    const asset = await assets.findById(command.mediaId);
    if (asset === undefined || asset.ownerId !== command.principal.userId) throw notFound("Media");
    await assets.delete(asset.id);
    await blobs.remove(asset.originalKey);
    await blobs.removeAllWithPrefix(publicAssetPrefix(asset.id));
  }
}
