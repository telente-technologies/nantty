import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { UpdateChatSettingsCommand } from "../commands/updateChatSettings/updateChatSettings.command.js";
import type { ChatSettingsView } from "../models/chatSettings.model.js";
import type { GetChatSettingsQuery } from "../queries/getChatSettings/getChatSettings.query.js";
import { updateChatSettingsBodySchema } from "../validators/chatSettings.validator.js";

export interface ChatSettingsHandlers {
  readonly getChatSettings: Handler<GetChatSettingsQuery, ChatSettingsView>;
  readonly updateChatSettings: Handler<UpdateChatSettingsCommand, ChatSettingsView>;
}

export function createChatSettingsController(route: RouteFactory, handlers: ChatSettingsHandlers) {
  return {
    get: route({ authentication: "required" }, ({ principal }) => handlers.getChatSettings({ accountId: principal.accountId })),
    update: route({ authentication: "required", body: updateChatSettingsBodySchema }, ({ principal, body }) =>
      handlers.updateChatSettings({ accountId: principal.accountId, messageRequestsFrom: body.messageRequestsFrom, notifications: body.notifications, timezone: body.timezone })),
  };
}
