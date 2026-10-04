import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreatePrivateAccessUrlCommand } from "../commands/createPrivateAccessUrl/createPrivateAccessUrl.handler.js";
import type { CreateUploadIntentCommand, UploadIntentView } from "../commands/createUploadIntent/createUploadIntent.handler.js";
import type { ReviewHeldMediaCommand } from "../commands/reviewHeldMedia/reviewHeldMedia.handler.js";
import type { InternalMediaView } from "../queries/getInternalMedia/getInternalMedia.handler.js";
import type { CompletedUploadView, CompleteUploadSessionCommand } from "../../uploads/commands/completeUploadSession/completeUploadSession.command.js";
import { deleteMediaBodySchema, internalCompleteBodySchema, internalMediaParamsSchema, privateAccessBodySchema, reviewBodySchema, uploadIntentBodySchema } from "../validators/internal.validator.js";

export interface InternalHandlers {
  readonly createUploadIntent: Handler<CreateUploadIntentCommand, UploadIntentView>;
  readonly getInternalMedia: Handler<{ readonly mediaId: string }, InternalMediaView>;
  readonly createPrivateAccessUrl: Handler<CreatePrivateAccessUrlCommand, { readonly url: string; readonly expiresAt: string }>;
  readonly reviewHeldMedia: Handler<ReviewHeldMediaCommand, { readonly mediaId: string; readonly status: string }>;
  readonly completeUploadSession: Handler<CompleteUploadSessionCommand, CompletedUploadView>;
  readonly deleteMedia: Handler<{ readonly mediaIds: readonly string[]; readonly reason: string }, { readonly deleted: number }>;
}

export function createInternalController(route: RouteFactory, handlers: InternalHandlers) {
  return {
    createIntent: route({ authentication: "internal", body: uploadIntentBodySchema, successStatus: 201 }, ({ body }) => handlers.createUploadIntent({ accountId: body.accountId, purpose: body.purpose, contentType: body.contentType, sizeBytes: body.sizeBytes, fileName: body.fileName })),
    get: route({ authentication: "internal", params: internalMediaParamsSchema }, ({ params }) => handlers.getInternalMedia({ mediaId: params.mediaId })),
    signedUrl: route({ authentication: "internal", params: internalMediaParamsSchema, body: privateAccessBodySchema }, ({ params, body }) => handlers.createPrivateAccessUrl({ mediaId: params.mediaId, actorId: body.actorId, reason: body.reason, variant: body.variant, download: body.download ?? false })),
    review: route({ authentication: "internal", params: internalMediaParamsSchema, body: reviewBodySchema }, ({ params, body }) => handlers.reviewHeldMedia({ mediaId: params.mediaId, decision: body.decision, reviewerId: body.reviewerId })),
    complete: route({ authentication: "internal", params: internalMediaParamsSchema, body: internalCompleteBodySchema }, ({ params, body }) => handlers.completeUploadSession({ ownerId: body.accountId, lookup: { mediaId: params.mediaId } })),
    deleteMany: route({ authentication: "internal", body: deleteMediaBodySchema }, ({ body }) => handlers.deleteMedia({ mediaIds: body.mediaIds, reason: body.reason })),
  };
}
