import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { DownloadSettingsView } from "../../models/download.model.js";
import { downloadSettingRepository } from "../../repositories/downloadSetting.repository.js";
import type { UpdateDownloadSettingsCommand } from "./updateDownloadSettings.command.js";

export function createUpdateDownloadSettingsHandler(context: HandlerContext): Handler<UpdateDownloadSettingsCommand, DownloadSettingsView> {
  return async ({ accountId, allowDownloads }) => ({ allowDownloads: (await downloadSettingRepository.upsertSetting(context.database.client, accountId, allowDownloads)).allowDownloads });
}
