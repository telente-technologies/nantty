import type { LinkedProfiles } from "@/types/brand.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const linkedProfilesService = {
  fetchMine: () => sendRequestToWebappServer<LinkedProfiles>("/api/v1/users/me/linked-profiles"),
  chooseWhichToKeep: (keep: readonly string[], stepUpToken: string) =>
    sendRequestToWebappServer<LinkedProfiles>("/api/v1/users/me/linked-profiles/choose", { method: "POST", body: { keep }, stepUpToken }),
};
