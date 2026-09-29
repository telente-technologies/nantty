import { QueryHandler } from "@zudojs/cqrs";

import { convertMediaAssetToDto, type MediaAssetDto } from "../../dtos/media.dto.js";
import type { MediaService } from "../../services/media.service.js";
import type { GetMediaQuery } from "./getMedia.query.js";

export class GetMediaHandler extends QueryHandler<GetMediaQuery, MediaAssetDto> {
  public readonly queryType = "media.getMedia" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(query: GetMediaQuery): Promise<MediaAssetDto> {
    const asset = await this.mediaService.findViewableAssetOrThrow(query.mediaId, query.viewer);
    return convertMediaAssetToDto(asset, this.mediaService, query.viewer?.userId === asset.ownerId);
  }
}
