import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ChatSettingsView } from "../../models/chatSettings.model.js";
import { toChatSettingsView } from "../../models/chatSettingsView.model.js";
import { chatSettingsRepository } from "../../repositories/chatSettings.repository.js";
import type { GetChatSettingsQuery } from "./getChatSettings.query.js";

export function createGetChatSettingsHandler(context: HandlerContext): Handler<GetChatSettingsQuery, ChatSettingsView> {
  return async ({ accountId }) => toChatSettingsView(await chatSettingsRepository.find(context.database.client, accountId));
}
