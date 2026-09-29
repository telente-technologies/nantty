import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { isPublicFileKey } from "../../models/mediaAsset.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { StoredBlob } from "../../services/mediaBlobStore.service.js";
import type { GetPublicFileQuery } from "./getPublicFile.query.js";

export class GetPublicFileHandler extends QueryHandler<GetPublicFileQuery, StoredBlob> {
  public readonly queryType = "media.getPublicFile" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(query: GetPublicFileQuery): Promise<StoredBlob> {
    if (!isPublicFileKey(query.storageKey)) throw notFound("File");
    const file = await this.mediaService.dependencies.blobs.read(query.storageKey);
    if (file === undefined) throw notFound("File");
    return file;
  }
}
