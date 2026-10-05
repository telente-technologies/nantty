import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";

export interface TaggingSettingsView {
  readonly allowTagging: boolean;
}

export interface UpdateTaggingSettingsCommand {
  readonly accountId: string;
  readonly allowTagging: boolean;
}

export function createUpdateTaggingSettingsHandler(context: HandlerContext): Handler<UpdateTaggingSettingsCommand, TaggingSettingsView> {
  return async ({ accountId, allowTagging }) => {
    const row = await postTagRepository.upsertSetting(context.database.client, accountId, allowTagging);
    return { allowTagging: row.allowTagging };
  };
}
