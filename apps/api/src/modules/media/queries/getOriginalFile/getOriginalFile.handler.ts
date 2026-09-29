import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { isPrivatePurpose } from "../../models/mediaUpload.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { StoredBlob } from "../../services/mediaBlobStore.service.js";
import type { GetOriginalFileQuery } from "./getOriginalFile.query.js";

export class GetOriginalFileHandler extends QueryHandler<GetOriginalFileQuery, StoredBlob> {
  public readonly queryType = "media.getOriginalFile" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(query: GetOriginalFileQuery): Promise<StoredBlob> {
    const { assets, blobs } = this.mediaService.dependencies;
    const asset = await assets.findById(query.mediaId);
    const allowed = asset !== undefined && (asset.ownerId === query.principal.userId || (isPrivatePurpose(asset.purpose) && this.mediaService.viewerMayReadPrivateAsset(asset, query.principal)));
    if (!allowed || asset.status === "failed") throw notFound("Media");
    const file = await blobs.read(asset.originalKey);
    if (file === undefined) throw notFound("Media");
    return { bytes: file.bytes, contentType: asset.mimeType };
  }
}
