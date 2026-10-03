import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createUpdateChatSettingsHandler } from "./commands/updateChatSettings/updateChatSettings.handler.js";
import { createChatSettingsController } from "./controllers/chatSettings.controller.js";
import { createGetChatSettingsHandler } from "./queries/getChatSettings/getChatSettings.handler.js";
import { registerChatSettingsRoutes } from "./routes/chatSettings.routes.js";

export function mountChatSettingsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerChatSettingsRoutes(router, createChatSettingsController(route, {
    getChatSettings: createGetChatSettingsHandler(context),
    updateChatSettings: createUpdateChatSettingsHandler(context),
  }));
}
