import type { ContentPreferences } from "@/types/postAudience.type";

import { api } from "../core/apiClient.service";

export const contentPreferencesService = {
  fetchContentPreferences: () => api.get<ContentPreferences>("/api/v1/me/content-preferences"),
  updateContentPreferences: (showSensitiveWithoutWarning: boolean) => api.put<ContentPreferences>("/api/v1/me/content-preferences", { showSensitiveWithoutWarning }),
};
