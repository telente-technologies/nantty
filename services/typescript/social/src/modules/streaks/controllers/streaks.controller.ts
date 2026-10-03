import { schema } from "@zudojs/schema";

import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { AcknowledgeStreakCelebrationCommand } from "../commands/acknowledgeStreakCelebration/acknowledgeStreakCelebration.command.js";
import type { RestoreStreakCommand } from "../commands/restoreStreak/restoreStreak.command.js";
import type { StreakView } from "../services/streakEngine.service.js";

export interface StreaksHandlers {
  readonly restoreStreak: Handler<RestoreStreakCommand, StreakView>;
  readonly acknowledgeStreakCelebration: Handler<AcknowledgeStreakCelebrationCommand, void>;
}

const params = schema.object({ conversationId: schema.string().uuid() });

export function createStreaksController(route: RouteFactory, handlers: StreaksHandlers) {
  return {
    restore: route({ authentication: "required", params }, ({ principal, params: input }) => handlers.restoreStreak({ viewerId: principal.accountId, conversationId: input.conversationId })),
    celebrated: route({ authentication: "required", params }, ({ principal, params: input }) => handlers.acknowledgeStreakCelebration({ viewerId: principal.accountId, conversationId: input.conversationId })),
  };
}
