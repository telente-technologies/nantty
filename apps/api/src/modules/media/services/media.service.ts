import type { EventBus } from "@zudojs/events";

import type { AppSettings } from "../../../configs/settings.config.js";
import { forbidden, notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import { isImageContentType, type MediaContentType, type MediaRecord } from "../models/media.model.js";
import type { MediaRepository } from "../repositories/media.repository.js";
import type { MediaBlobStore } from "./mediaBlobStore.service.js";

export interface MediaDependencies {
  readonly media: MediaRepository;
  readonly blobs: MediaBlobStore;
  readonly settings: AppSettings["media"];
  readonly clock: Clock;
  readonly events: EventBus;
}

export class MediaService {
  private readonly signingKey: Uint8Array;

  public constructor(public readonly dependencies: MediaDependencies) {
    this.signingKey = new TextEncoder().encode(`media-upload:${dependencies.settings.signingSecret}`);
  }

  public maximumBytesFor(contentType: MediaContentType): number {
    const { maxImageBytes, maxVideoBytes } = this.dependencies.settings;
    return isImageContentType(contentType) ? maxImageBytes : maxVideoBytes;
  }

  public buildMediaUrl(mediaId: string): string {
    return `${this.dependencies.settings.publicBaseUrl}/api/v1/media/${mediaId}`;
  }

  public async buildSignedUploadUrl(media: MediaRecord, expiresAtSeconds: number): Promise<string> {
    const signature = await this.signUpload(media, expiresAtSeconds);
    return `${this.dependencies.settings.publicBaseUrl}/api/v1/media/uploads/${media.id}?expires=${expiresAtSeconds}&signature=${signature}`;
  }

  public async assertUploadSignatureIsValid(media: MediaRecord, expiresAtSeconds: number, signature: string): Promise<void> {
    const expected = await this.signUpload(media, expiresAtSeconds);
    if (!hashesAreEqual(expected, signature)) throw forbidden("The upload link is invalid.");
    if (expiresAtSeconds * 1000 <= this.dependencies.clock.now().getTime()) throw forbidden("The upload link has expired.");
  }

  public async findMediaOrThrow(mediaId: string): Promise<MediaRecord> {
    const media = await this.dependencies.media.findById(mediaId);
    if (media === undefined) throw notFound("Media");
    return media;
  }

  private signUpload(media: MediaRecord, expiresAtSeconds: number): Promise<string> {
    return hashSecretWithKey(`${media.id}.${expiresAtSeconds}.${media.contentType}.${media.maxBytes}`, this.signingKey);
  }
}
