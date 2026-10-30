import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createMentionsController } from "./controllers/mentions.controller.js";
import { createListMentionCandidatesHandler } from "./queries/listMentionCandidates/listMentionCandidates.handler.js";
import { createResolveMentionTargetsHandler } from "./queries/resolveMentionTargets/resolveMentionTargets.handler.js";
import { registerMentionsRoutes } from "./routes/mentions.routes.js";

export function mountMentionsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerMentionsRoutes(router, createMentionsController(route, {
    listMentionCandidates: createListMentionCandidatesHandler(context),
    resolveMentionTargets: createResolveMentionTargetsHandler(context),
  }));
}
