import { QueryHandler } from "@zudojs/cqrs";

import { convertMediaAssetToDto, listUploadedChunkIndexes, type UploadProgressDto } from "../../dtos/media.dto.js";
import type { MediaService } from "../../services/media.service.js";
import type { GetUploadQuery } from "./getUpload.query.js";

export class GetUploadHandler extends QueryHandler<GetUploadQuery, UploadProgressDto> {
  public readonly queryType = "media.getUpload" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(query: GetUploadQuery): Promise<UploadProgressDto> {
    const { uploads, assets } = this.mediaService.dependencies;
    const upload = await this.mediaService.findOwnedUploadOrThrow(query.uploadId, query.principal.userId);
    const uploadedChunks = listUploadedChunkIndexes(await uploads.listChunks(upload.id));
    if (upload.status === "failed") return { status: "failed", uploadedChunks, ...(upload.failureReason === null ? {} : { failureReason: upload.failureReason }) };
    if (upload.status === "uploading") return { status: "uploading", uploadedChunks };
    const asset = upload.mediaId === null ? undefined : await assets.findById(upload.mediaId);
    if (asset === undefined) return { status: "processing", uploadedChunks };
    return { status: asset.status, uploadedChunks, media: convertMediaAssetToDto(asset, this.mediaService, true) };
  }
}
