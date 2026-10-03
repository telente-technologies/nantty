import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { streakRepository } from "../../repositories/streak.repository.js";
import type { AcknowledgeStreakCelebrationCommand } from "./acknowledgeStreakCelebration.command.js";

export function createAcknowledgeStreakCelebrationHandler(context: HandlerContext): Handler<AcknowledgeStreakCelebrationCommand, void> {
  return async ({ viewerId, conversationId }) => {
    await requireConversationMember(context.database.client, conversationId, viewerId);
    await streakRepository.markCelebrated(context.database.client, conversationId, viewerId, context.clock.now());
  };
}
