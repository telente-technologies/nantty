import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";
import type { TaggingSettingsView } from "../../commands/updateTaggingSettings/updateTaggingSettings.handler.js";

export function createGetTaggingSettingsHandler(context: HandlerContext): Handler<{ readonly accountId: string }, TaggingSettingsView> {
  return async ({ accountId }) => ({ allowTagging: (await postTagRepository.findSetting(context.database.client, accountId))?.allowTagging ?? true });
}
