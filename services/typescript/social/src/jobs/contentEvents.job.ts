import type { Logger } from "@zudojs/logger";

import type { MessageConsumerFactory } from "../interfaces/domainEventConsumer.interface.js";
import { createApplyContentVisibilityHandler } from "../modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import { createApplyCopyrightAudioRemedyHandler } from "../modules/contentEvents/commands/applyCopyrightAudioRemedy/applyCopyrightAudioRemedy.handler.js";
import { createApplySensitiveLabelsHandler } from "../modules/contentEvents/commands/applySensitiveLabels/applySensitiveLabels.handler.js";
import { createApplyProcessedMediaHandler } from "../modules/contentEvents/commands/applyProcessedMedia/applyProcessedMedia.handler.js";
import { createContentEventRouter } from "../modules/contentEvents/services/contentEventRouter.service.js";
import type { HandlerContext } from "../types/handlerContext.type.js";

export function startContentEventConsumer(context: HandlerContext, factory: MessageConsumerFactory, queue: string, mediaPublicBaseUrl: string, logger: Logger): () => Promise<void> {
  const route = createContentEventRouter({
    applyContentVisibility: createApplyContentVisibilityHandler(context),
    applyProcessedMedia: createApplyProcessedMediaHandler(context, mediaPublicBaseUrl),
    applySensitiveLabels: createApplySensitiveLabelsHandler(context),
    applyCopyrightAudioRemedy: createApplyCopyrightAudioRemedyHandler(context),
  });
  const consumer = factory.createConsumer("socialContentEvents", queue, route);
  consumer.start();
  logger.info("social content event consumer started", { queue });
  return () => consumer.stop();
}
