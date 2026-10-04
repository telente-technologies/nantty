import type { GuestReportReason, ID, LiveSafetyState, StageGuest } from "@/types";

import { sendRequestToStudioServer } from "./clientApi.service";

const createIdempotencyKey = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export const liveSafetyService = {
  fetchLiveSafety: async (liveId: ID) => (await sendRequestToStudioServer<{ readonly safety: LiveSafetyState | null }>(`/api/v1/lives/${liveId}/safety`)).safety,
  appealLiveSafetyHold: (liveId: ID, message: string) =>
    sendRequestToStudioServer<{ readonly status: "received" }>(`/api/v1/live-safety/${liveId}/appeal`, { method: "POST", body: { message }, idempotencyKey: createIdempotencyKey("appeal") }),
  listStageGuests: async (liveId: ID) =>
    (await sendRequestToStudioServer<{ readonly streamers: readonly StageGuest[] }>(`/api/v1/lives/${liveId}/stage`)).streamers.filter((streamer) => streamer.role === "guest"),
  reportGuest: (liveId: ID, guestUserId: ID, reason: GuestReportReason, details: string) =>
    sendRequestToStudioServer<{ readonly id: ID; readonly status: "received" }>("/api/v1/reports", {
      method: "POST",
      body: { targetType: "user", targetId: guestUserId, reportedUserId: guestUserId, reason, details: [`Reported from the control room of live ${liveId}.`, details].filter(Boolean).join(" ") },
      idempotencyKey: createIdempotencyKey("report"),
    }),
};
