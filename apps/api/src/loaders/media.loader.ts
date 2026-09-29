import type { MediaLibrary } from "../interfaces/mediaLibrary.interface.js";
import { MediaController } from "../modules/media/controllers/media.controller.js";
import { MediaFilesController } from "../modules/media/controllers/mediaFiles.controller.js";
import { createAbandonedUploadsCleanupJob, createStalledMediaProcessingJob } from "../modules/media/jobs/mediaMaintenance.job.js";
import { registerMediaCommandAndQueryHandlers } from "../modules/media/media.module.js";
import { PrismaMediaAssetsRepository } from "../modules/media/repositories/mediaAssets.prisma.repository.js";
import { InMemoryMediaAssetsRepository } from "../modules/media/repositories/mediaAssets.repository.js";
import { PrismaMediaUploadsRepository } from "../modules/media/repositories/mediaUploads.prisma.repository.js";
import { InMemoryMediaUploadsRepository } from "../modules/media/repositories/mediaUploads.repository.js";
import { FfmpegVideoProcessor } from "../modules/media/services/ffmpegVideoProcessor.service.js";
import { MediaService } from "../modules/media/services/media.service.js";
import { MediaAssemblyService } from "../modules/media/services/mediaAssembly.service.js";
import { InMemoryMediaBlobStore, ObjectStorageMediaBlobStore, type MediaBlobStore } from "../modules/media/services/mediaBlobStore.service.js";
import { RepositoryMediaLibrary } from "../modules/media/services/mediaLibrary.service.js";
import { MediaMaintenanceService } from "../modules/media/services/mediaMaintenance.service.js";
import type { MediaProcessors } from "../modules/media/services/mediaProcessing.service.js";
import { MediaProcessingService } from "../modules/media/services/mediaProcessing.service.js";
import { MediaProcessingQueue } from "../modules/media/services/mediaProcessingQueue.service.js";
import { SharpImageProcessor } from "../modules/media/services/sharpImageProcessor.service.js";
import type { Core } from "./core.loader.js";

export interface MediaExternalServices {
  readonly mediaBlobStore?: MediaBlobStore;
  readonly mediaProcessors?: Partial<MediaProcessors>;
}

export function createMediaModule(core: Core, external: MediaExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const settings = core.settings.media;
  const mediaService = new MediaService({
    uploads: usePrisma ? new PrismaMediaUploadsRepository() : new InMemoryMediaUploadsRepository(),
    assets: usePrisma ? new PrismaMediaAssetsRepository() : new InMemoryMediaAssetsRepository(),
    blobs: external.mediaBlobStore ?? (usePrisma ? new ObjectStorageMediaBlobStore() : new InMemoryMediaBlobStore()),
    settings,
    clock: core.clock,
    events: core.events,
    logger: core.logger,
  });
  const processors: MediaProcessors = {
    image: external.mediaProcessors?.image ?? new SharpImageProcessor(),
    video: external.mediaProcessors?.video ?? new FfmpegVideoProcessor({ ffmpegPath: settings.ffmpegPath, ffprobePath: settings.ffprobePath }),
  };
  const processingQueue = new MediaProcessingQueue(new MediaProcessingService(mediaService, processors), { settings, keepProcessAlive: usePrisma });
  registerMediaCommandAndQueryHandlers(core.commands, core.queries, mediaService, new MediaAssemblyService(mediaService, processingQueue));
  const maintenance = new MediaMaintenanceService(mediaService, processingQueue);
  const mediaLibrary: MediaLibrary = new RepositoryMediaLibrary(mediaService);
  return {
    mediaLibrary,
    mediaProcessingQueue: processingQueue,
    scheduledJobs: [createAbandonedUploadsCleanupJob(maintenance), createStalledMediaProcessingJob(maintenance)],
    controllers: {
      mediaController: new MediaController(core.commands, core.queries),
      mediaFilesController: new MediaFilesController(core.queries),
    },
  };
}
