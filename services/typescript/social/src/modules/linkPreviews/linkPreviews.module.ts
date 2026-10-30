import type { HttpRouter } from "@nantty/fastify-platform";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createRefreshPostLinkPreviewHandler } from "./commands/refreshPostLinkPreview/refreshPostLinkPreview.handler.js";
import { createLinkPreviewsController } from "./controllers/linkPreviews.controller.js";
import { createResolveLinkPreviewHandler } from "./queries/resolveLinkPreview/resolveLinkPreview.handler.js";
import { registerLinkPreviewsRoutes } from "./routes/linkPreviews.routes.js";

export function mountLinkPreviewsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerLinkPreviewsRoutes(router, createLinkPreviewsController(route, {
    resolveLinkPreview: createResolveLinkPreviewHandler(context),
    refreshPostLinkPreview: createRefreshPostLinkPreviewHandler(context),
  }));
}
