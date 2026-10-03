import { mediaJobQueueName, processMediaJobType } from "../../../../constants/media.constant.js";
import { conflict, notFound } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";
import { rejectAsset } from "../../../assets/services/mediaPipeline.service.js";
import { randomUUID } from "node:crypto";

export interface ReviewHeldMediaCommand {
  readonly mediaId: string;
  readonly decision: "approve" | "reject";
  readonly reviewerId: string;
}

export function createReviewHeldMediaHandler(context: HandlerContext): Handler<ReviewHeldMediaCommand, { readonly mediaId: string; readonly status: string }> {
  return async (command) => {
    const asset = await mediaAssetRepository.findById(context.database.client, command.mediaId);
    if (asset === null) throw notFound("MEDIA_NOT_FOUND", "Media not found");
    if (asset.status !== "held") throw conflict("MEDIA_NOT_HELD", "Only held media can be reviewed.");
    if (command.decision === "reject") {
      await rejectAsset(context, asset, "MODERATION_REJECTED");
      return { mediaId: asset.id, status: "rejected" };
    }
    await context.jobs.enqueueJob(mediaJobQueueName, { id: randomUUID(), type: processMediaJobType, payload: { mediaId: asset.id, moderationApproved: true, reviewerId: command.reviewerId } });
    return { mediaId: asset.id, status: "processing" };
  };
}
