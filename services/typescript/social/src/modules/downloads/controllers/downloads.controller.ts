import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { RequestPostMediaDownloadCommand } from "../commands/requestPostMediaDownload/requestPostMediaDownload.command.js";
import type { UpdateDownloadSettingsCommand } from "../commands/updateDownloadSettings/updateDownloadSettings.command.js";
import type { DownloadSettingsView, PostMediaDownloadView } from "../models/download.model.js";
import { downloadSettingsBodySchema, postMediaDownloadParamsSchema } from "../validators/downloads.validator.js";

export interface DownloadsHandlers {
  readonly requestPostMediaDownload: Handler<RequestPostMediaDownloadCommand, PostMediaDownloadView>;
  readonly getDownloadSettings: Handler<{ readonly accountId: string }, DownloadSettingsView>;
  readonly updateDownloadSettings: Handler<UpdateDownloadSettingsCommand, DownloadSettingsView>;
}

export function createDownloadsController(route: RouteFactory, handlers: DownloadsHandlers) {
  return {
    requestDownload: route({ authentication: "required", params: postMediaDownloadParamsSchema }, ({ principal, params }) =>
      handlers.requestPostMediaDownload({ viewerId: principal.accountId, postId: params.postId, mediaId: params.mediaId })),
    getSettings: route({ authentication: "required" }, ({ principal }) => handlers.getDownloadSettings({ accountId: principal.accountId })),
    updateSettings: route({ authentication: "required", body: downloadSettingsBodySchema }, ({ principal, body }) =>
      handlers.updateDownloadSettings({ accountId: principal.accountId, allowDownloads: body.allowDownloads })),
  };
}
