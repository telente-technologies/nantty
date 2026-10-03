import { deleteMediaJobType, processMediaJobType } from "../constants/media.constant.js";
import type { JobHandlers } from "../interfaces/jobQueue.interface.js";
import { deleteMediaAssets } from "../modules/assets/services/mediaDeletion.service.js";
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
  };
}
