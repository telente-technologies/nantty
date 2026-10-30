import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createAcknowledgeStreakCelebrationHandler } from "./commands/acknowledgeStreakCelebration/acknowledgeStreakCelebration.handler.js";
import { createRestoreStreakHandler } from "./commands/restoreStreak/restoreStreak.handler.js";
import { createStreaksController } from "./controllers/streaks.controller.js";
import { registerStreaksRoutes } from "./routes/streaks.routes.js";

export function mountStreaksModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerStreaksRoutes(router, createStreaksController(route, {
    restoreStreak: createRestoreStreakHandler(context),
    acknowledgeStreakCelebration: createAcknowledgeStreakCelebrationHandler(context),
  }));
}
