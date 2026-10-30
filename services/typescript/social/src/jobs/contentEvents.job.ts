import type { Logger } from "@nantty/fastify-platform";

import type { MessageConsumerFactory } from "../interfaces/domainEventConsumer.interface.js";
import { createApplyContentVisibilityHandler } from "../modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import { createApplyCopyrightAudioRemedyHandler } from "../modules/contentEvents/commands/applyCopyrightAudioRemedy/applyCopyrightAudioRemedy.handler.js";
import { createApplySensitiveLabelsHandler } from "../modules/contentEvents/commands/applySensitiveLabels/applySensitiveLabels.handler.js";
import { createApplyProcessedMediaHandler } from "../modules/contentEvents/commands/applyProcessedMedia/applyProcessedMedia.handler.js";
import { createAcceptPendingFollowRequestsHandler } from "../modules/follows/commands/acceptPendingFollowRequests/acceptPendingFollowRequests.handler.js";
import { createBlockUserHandler } from "../modules/blocks/commands/blockUser/blockUser.handler.js";
import { createRevokeStoreInboxAccessHandler } from "../modules/storeInbox/commands/revokeStoreInboxAccess/revokeStoreInboxAccess.handler.js";
import { createContentEventRouter } from "../modules/contentEvents/services/contentEventRouter.service.js";
import type { HandlerContext } from "../types/handlerContext.type.js";

export function startContentEventConsumer(context: HandlerContext, factory: MessageConsumerFactory, queue: string, mediaPublicBaseUrl: string, logger: Logger): () => Promise<void> {
  const route = createContentEventRouter({
    applyContentVisibility: createApplyContentVisibilityHandler(context),
    applyProcessedMedia: createApplyProcessedMediaHandler(context, mediaPublicBaseUrl),
    applySensitiveLabels: createApplySensitiveLabelsHandler(context),
    applyCopyrightAudioRemedy: createApplyCopyrightAudioRemedyHandler(context),
    blockReportedUser: blockForChatReport(createBlockUserHandler(context)),
    revokeStoreInboxAccess: createRevokeStoreInboxAccessHandler(context),
    acceptPendingFollowRequests: createAcceptPendingFollowRequestsHandler(context),
  });
  const consumer = factory.createConsumer("socialContentEvents", queue, route);
  consumer.start();
  logger.info("social content event consumer started", { queue });
  return () => consumer.stop();
}

const ignorableBlockFailures = new Set(["CANNOT_BLOCK_SELF", "USER_NOT_FOUND"]);

export function blockForChatReport(block: (command: { readonly blockerId: string; readonly targetId: string }) => Promise<void>) {
  return async ({ reporterId, reportedUserId }: { readonly reporterId: string; readonly reportedUserId: string }): Promise<void> => {
    try {
      await block({ blockerId: reporterId, targetId: reportedUserId });
    } catch (error) {
      const code = (error as { readonly code?: unknown } | null)?.code;
      if (typeof code === "string" && ignorableBlockFailures.has(code)) return;
      throw error;
    }
  };
}
