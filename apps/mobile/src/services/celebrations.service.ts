import type { CelebrationKind, CelebrationSettingsUpdate, CelebrationSurface, ViewerCelebrations } from "@/types/celebrations.type";

import { api } from "./apiClient.service";

export const celebrationsService = {
  fetchMine: () => api.get<ViewerCelebrations>("/api/v1/users/me/celebrations"),
  markSeen: (kind: CelebrationKind, surface: CelebrationSurface) => api.post<void>("/api/v1/users/me/celebrations/seen", { kind, surface }),
  updateSettings: (update: CelebrationSettingsUpdate) => api.patch<ViewerCelebrations>("/api/v1/users/me/celebrations/settings", update),
};
