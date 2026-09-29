import type { MediaProcessingScheduler } from "./mediaAssembly.service.js";
import type { MediaService } from "./media.service.js";

const CLEANUP_BATCH_SIZE = 200;
const STALLED_PROCESSING_SECONDS = 2 * 3_600;

export class MediaMaintenanceService {
  public constructor(
    private readonly mediaService: MediaService,
    private readonly processingScheduler: MediaProcessingScheduler,
  ) {}

  public async deleteAbandonedUploads(): Promise<number> {
    const { uploads, blobs, clock, settings } = this.mediaService.dependencies;
    const cutoff = new Date(clock.now().getTime() - settings.abandonedUploadSeconds * 1000);
    const abandoned = await uploads.listUnfinishedCreatedBefore(cutoff, CLEANUP_BATCH_SIZE);
    for (const upload of abandoned) {
      for (const chunk of await uploads.listChunks(upload.id)) await blobs.remove(chunk.storageKey);
      await uploads.delete(upload.id);
    }
    return abandoned.length;
  }

  public async requeueStalledProcessing(): Promise<number> {
    const { assets, clock } = this.mediaService.dependencies;
    const cutoff = new Date(clock.now().getTime() - STALLED_PROCESSING_SECONDS * 1000);
    const stalled = await assets.listProcessingUpdatedBefore(cutoff, CLEANUP_BATCH_SIZE);
    for (const asset of stalled) await this.processingScheduler.enqueueProcessing(asset.id);
    return stalled.length;
  }
}
