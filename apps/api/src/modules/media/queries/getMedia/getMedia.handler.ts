import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { MediaRecord } from "../../models/media.model.js";
import type { MediaService } from "../../services/media.service.js";
import type { GetMediaQuery } from "./getMedia.query.js";

export interface MediaFile {
  readonly media: MediaRecord;
  readonly bytes: Uint8Array;
}

export class GetMediaHandler extends QueryHandler<GetMediaQuery, MediaFile> {
  public readonly queryType = "media.getMedia" as const;

  public constructor(private readonly mediaService: MediaService) {
    super();
  }

  public async execute(query: GetMediaQuery): Promise<MediaFile> {
    const media = await this.mediaService.findMediaOrThrow(query.mediaId);
    const bytes = media.status === "uploaded" ? await this.mediaService.dependencies.blobs.read(media.key) : undefined;
    if (bytes === undefined) throw notFound("Media");
    return { media, bytes };
  }
}
