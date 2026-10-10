import type { DownloadSettings, PostMediaDownload } from "@/types";

import { api } from "../core/apiClient.service";

export const mediaDownloadsService = {
  requestPostMediaDownload: (postId: string, mediaId: string) =>
    api.post<PostMediaDownload>(`/api/v1/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}/download`),
  fetchMyDownloadSettings: () => api.get<DownloadSettings>("/api/v1/me/download-settings"),
  updateMyDownloadSettings: (settings: DownloadSettings) => api.put<DownloadSettings>("/api/v1/me/download-settings", settings),
};
