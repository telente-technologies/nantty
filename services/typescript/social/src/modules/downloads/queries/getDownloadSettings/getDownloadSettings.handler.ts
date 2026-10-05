import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { DownloadSettingsView } from "../../models/download.model.js";
import { downloadSettingRepository } from "../../repositories/downloadSetting.repository.js";

export function createGetDownloadSettingsHandler(context: HandlerContext): Handler<{ readonly accountId: string }, DownloadSettingsView> {
  return async ({ accountId }) => ({ allowDownloads: (await downloadSettingRepository.findSetting(context.database.client, accountId))?.allowDownloads ?? true });
}
