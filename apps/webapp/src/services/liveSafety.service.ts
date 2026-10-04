import { createIdempotencyKey, sendRequestToWebappServer } from "@/services/clientApi.service";
import type { ID, LiveReportContext, LiveReportReason, LiveSafetyAppealReceipt, LiveSafetyState } from "@/types";

export const liveSafetyService = {
  reportLive: (liveId: ID, reason: LiveReportReason, details: string, liveContext: LiveReportContext) =>
    sendRequestToWebappServer<{ id: ID; status: string }>("/api/v1/reports", {
      method: "POST",
      body: { targetType: "live", targetId: liveId, reason, details, liveContext },
      idempotencyKey: createIdempotencyKey("report"),
    }),
  fetchLiveSafetyState: (liveId: ID) => sendRequestToWebappServer<{ safety: LiveSafetyState | null }>(`/api/v1/lives/${liveId}/safety`),
  appealLiveSafetyHold: (liveId: ID, message: string) =>
    sendRequestToWebappServer<LiveSafetyAppealReceipt>(`/api/v1/live-safety/${liveId}/appeal`, { method: "POST", body: { message }, idempotencyKey: createIdempotencyKey("appeal") }),
};
