import { deleteMediaJobType, muteMediaAudioJobType, processMediaJobType, renderDownloadVariantJobType } from "../constants/media.constant.js";
import type { JobHandlers } from "../interfaces/jobQueue.interface.js";
import { muteMediaAudio, restoreMediaAudio } from "../modules/assets/services/audioRemedy.service.js";
import { deleteMediaAssets } from "../modules/assets/services/mediaDeletion.service.js";
import { renderQueuedDownloadVariant } from "../modules/downloads/services/downloadVariantRendering.service.js";
import { runMediaPipeline } from "../modules/assets/services/mediaPipeline.service.js";
import type { HandlerContext } from "../types/handlerContext.type.js";

export function createMediaJobHandlers(context: HandlerContext): JobHandlers {
  return {
    [processMediaJobType]: async (payload, attempt) => {
      if (typeof payload["mediaId"] !== "string") return;
      await runMediaPipeline(context, payload["mediaId"], { attempt, moderationApproved: payload["moderationApproved"] === true });
    },
    [deleteMediaJobType]: async (payload) => {
      const mediaIds = Array.isArray(payload["mediaIds"]) ? payload["mediaIds"].filter((value): value is string => typeof value === "string") : [];
      await deleteMediaAssets(context, mediaIds, typeof payload["reason"] === "string" ? payload["reason"] : "requested");
    },
    [muteMediaAudioJobType]: async (payload) => {
      if (typeof payload["mediaId"] !== "string") return;
      const claimId = typeof payload["claimId"] === "string" ? payload["claimId"] : null;
      await (payload["mode"] === "restore" ? restoreMediaAudio : muteMediaAudio)(context, payload["mediaId"], claimId);
    },
    [renderDownloadVariantJobType]: async (payload, attempt) => {
      if (typeof payload["variantId"] !== "string") return;
      await renderQueuedDownloadVariant(context, payload["variantId"], attempt);
    },
  };
}
