import type { DownloadSettings, PostMediaDownload } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const mediaDownloadsService = {
  requestPostMediaDownload: (postId: string, mediaId: string, signal?: AbortSignal) =>
    sendRequestToWebappServer<PostMediaDownload>(`/api/v1/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}/download`, { method: "POST", signal }),
  fetchMyDownloadSettings: () => sendRequestToWebappServer<DownloadSettings>("/api/v1/me/download-settings"),
  updateMyDownloadSettings: (settings: DownloadSettings) => sendRequestToWebappServer<DownloadSettings>("/api/v1/me/download-settings", { method: "PUT", body: settings }),
};
