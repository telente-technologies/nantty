import type { CelebrationKind, CelebrationSettingsUpdate, CelebrationSurface, ViewerCelebrations } from "@/types/celebrations.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const celebrationsService = {
  fetchMine: () => sendRequestToWebappServer<ViewerCelebrations>("/api/v1/users/me/celebrations"),
  markSeen: (kind: CelebrationKind, surface: CelebrationSurface) =>
    sendRequestToWebappServer<void>("/api/v1/users/me/celebrations/seen", { method: "POST", body: { kind, surface } }),
  updateSettings: (update: CelebrationSettingsUpdate) =>
    sendRequestToWebappServer<ViewerCelebrations>("/api/v1/users/me/celebrations/settings", { method: "PATCH", body: update }),
};
