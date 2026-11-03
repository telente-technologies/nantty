import type { ActingProfile } from "@/types/brand.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const actingProfileService = {
  fetchCurrent: () => sendRequestToWebappServer<ActingProfile>("/api/v1/users/me/acting-profile"),
  fetchMine: () => sendRequestToWebappServer<readonly ActingProfile[]>("/api/v1/users/me/profiles"),
  switchTo: (profileId: string) =>
    sendRequestToWebappServer<ActingProfile>("/api/v1/users/me/acting-profile", {
      method: "PUT",
      body: { profileId },
    }),
};
