import type { MediaLibrary, MediaLibraryItem, MediaOriginalFile } from "../../../interfaces/mediaLibrary.interface.js";
import type { MediaAssetRecord, MediaVariantRecord } from "../models/mediaAsset.model.js";
import { isPrivatePurpose } from "../models/mediaUpload.model.js";
import type { MediaService } from "./media.service.js";

const PREFERRED_DISPLAY_WIDTH = 1080;

function chooseDisplayImageVariant(variants: readonly MediaVariantRecord[]): MediaVariantRecord | undefined {
  for (const format of ["webp", "jpeg", "avif"] as const) {
    const candidates = variants.filter((variant) => variant.format === format).sort((left, right) => right.width - left.width);
    const choice = candidates.find((variant) => variant.width <= PREFERRED_DISPLAY_WIDTH) ?? candidates[candidates.length - 1];
    if (choice !== undefined) return choice;
  }
  return undefined;
}

export class RepositoryMediaLibrary implements MediaLibrary {
  public constructor(private readonly mediaService: MediaService) {}

  public async findMediaByIds(mediaIds: readonly string[]): Promise<readonly MediaLibraryItem[]> {
    const assets = await this.mediaService.dependencies.assets.findManyByIds([...new Set(mediaIds)]);
    return assets.map((asset) => this.convertAssetToLibraryItem(asset));
  }

  public async readMediaOriginal(mediaId: string): Promise<MediaOriginalFile | undefined> {
    const { assets, blobs } = this.mediaService.dependencies;
    const asset = await assets.findById(mediaId);
    if (asset === undefined || asset.status === "failed") return undefined;
    const file = await blobs.read(asset.originalKey);
    return file === undefined ? undefined : { bytes: file.bytes, contentType: asset.mimeType };
  }

  private convertAssetToLibraryItem(asset: MediaAssetRecord): MediaLibraryItem {
    const isPublicReady = asset.status === "ready" && !isPrivatePurpose(asset.purpose);
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      purpose: asset.purpose,
      type: asset.type,
      status: asset.status,
      url: isPublicReady ? this.findDisplayUrl(asset) : null,
      posterUrl: isPublicReady && asset.posterKey !== null ? this.mediaService.buildPublicFileUrl(asset.posterKey) : null,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds,
      blurhash: isPrivatePurpose(asset.purpose) ? null : asset.blurhash,
      failureReason: asset.failureReason,
    };
  }

  private findDisplayUrl(asset: MediaAssetRecord): string | null {
    const storageKey = asset.type === "video" ? asset.hlsMasterKey : chooseDisplayImageVariant(asset.variants)?.storageKey;
    return storageKey === null || storageKey === undefined ? null : this.mediaService.buildPublicFileUrl(storageKey);
  }
}
