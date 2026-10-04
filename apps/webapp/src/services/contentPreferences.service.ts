import type { ContentPreferences } from "@/types/postAudience.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const contentPreferencesService = {
  fetchContentPreferences: () => sendRequestToWebappServer<ContentPreferences>("/api/v1/me/content-preferences"),
  updateContentPreferences: (showSensitiveWithoutWarning: boolean) =>
    sendRequestToWebappServer<ContentPreferences>("/api/v1/me/content-preferences", { method: "PUT", body: { showSensitiveWithoutWarning } }),
};
