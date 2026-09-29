import type { EventBus } from "@zudojs/events";

import type { AppSettings } from "../../../configs/settings.config.js";
import { rolesGrantPermission } from "../../../constants/permissions.constant.js";
import { notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { MediaAssetRecord } from "../models/mediaAsset.model.js";
import { adminsMayReadPurpose, isPrivatePurpose, mediaTypeForMimeType, type MediaMimeType, type MediaPurpose, type UploadSessionRecord } from "../models/mediaUpload.model.js";
import type { MediaAssetsRepository } from "../repositories/mediaAssets.repository.js";
import type { MediaUploadsRepository } from "../repositories/mediaUploads.repository.js";
import type { MediaBlobStore } from "./mediaBlobStore.service.js";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PRIVATE_CACHE_CONTROL = "private, no-store";

export interface MediaDependencies {
  readonly uploads: MediaUploadsRepository;
  readonly assets: MediaAssetsRepository;
  readonly blobs: MediaBlobStore;
  readonly settings: AppSettings["media"];
  readonly clock: Clock;
  readonly events: EventBus;
  readonly logger: AppLogger;
}

export class MediaService {
  public constructor(public readonly dependencies: MediaDependencies) {}

  public maximumBytesFor(purpose: MediaPurpose, mimeType: MediaMimeType): number {
    const { maxImageBytes, maxProfileImageBytes, maxVideoBytes, maxKycBytes, maxVoiceBytes } = this.dependencies.settings;
    if (purpose === "kyc") return maxKycBytes;
    if (purpose === "voice") return maxVoiceBytes;
    if (purpose === "avatar" || purpose === "banner") return maxProfileImageBytes;
    return mediaTypeForMimeType(mimeType) === "video" ? maxVideoBytes : maxImageBytes;
  }

  public maximumVideoSecondsFor(purpose: MediaPurpose): number {
    const { maxClipSeconds, maxStorySeconds, maxVideoSeconds } = this.dependencies.settings;
    if (purpose === "clip") return maxClipSeconds;
    if (purpose === "story") return maxStorySeconds;
    return maxVideoSeconds;
  }

  public buildPublicFileUrl(storageKey: string): string {
    return `${this.dependencies.settings.publicBaseUrl}/api/v1/media/files/${storageKey}`;
  }

  public buildOriginalFileUrl(mediaId: string): string {
    return `${this.dependencies.settings.publicBaseUrl}/api/v1/media/${mediaId}/original`;
  }

  public async findOwnedUploadOrThrow(uploadId: string, ownerId: string): Promise<UploadSessionRecord> {
    const upload = await this.dependencies.uploads.findById(uploadId);
    if (upload === undefined || upload.ownerId !== ownerId) throw notFound("Upload");
    return upload;
  }

  public async findViewableAssetOrThrow(mediaId: string, viewer: Principal | undefined): Promise<MediaAssetRecord> {
    const asset = await this.dependencies.assets.findById(mediaId);
    if (asset === undefined || !this.viewerCanSeeAsset(asset, viewer)) throw notFound("Media");
    return asset;
  }

  public viewerCanSeeAsset(asset: MediaAssetRecord, viewer: Principal | undefined): boolean {
    if (viewer?.userId === asset.ownerId) return true;
    if (isPrivatePurpose(asset.purpose)) return viewer !== undefined && this.viewerMayReadPrivateAsset(asset, viewer);
    return asset.status === "ready";
  }

  public viewerMayReadPrivateAsset(asset: MediaAssetRecord, viewer: Principal): boolean {
    if (viewer.userId === asset.ownerId) return true;
    return adminsMayReadPurpose(asset.purpose) && rolesGrantPermission(viewer.roles, "media:read-private");
  }
}
