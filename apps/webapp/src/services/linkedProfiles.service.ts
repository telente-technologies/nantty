import type { LinkedProfiles, StoreTeamRequest } from "@/types/brand.type";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const linkedProfilesService = {
  fetchMine: () => sendRequestToWebappServer<LinkedProfiles>("/api/v1/users/me/linked-profiles"),
  chooseWhichToKeep: (keep: readonly string[], stepUpToken: string) =>
    sendRequestToWebappServer<LinkedProfiles>("/api/v1/users/me/linked-profiles/choose", { method: "POST", body: { keep }, stepUpToken }),
  fetchStoreTeamRequests: () => sendListRequestToWebappServer<StoreTeamRequest>("/api/v1/stores/team-requests"),
  acceptStoreTeamRequest: (requestId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/stores/team-requests/${encodeURIComponent(requestId)}/accept`, { method: "POST", body: {} }),
  declineStoreTeamRequest: (requestId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/stores/team-requests/${encodeURIComponent(requestId)}/decline`, { method: "POST", body: {} }),
};
