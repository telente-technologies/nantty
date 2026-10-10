import type { LiveSafetyAppealReceipt, LiveSafetyState } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

export const liveSafetyService = {
  fetchLiveSafetyState: (liveId: string) => api.get<{ readonly safety: LiveSafetyState | null }>(`/api/v1/lives/${liveId}/safety`),
  appealLiveSafetyHold: (liveId: string, message: string, idempotencyKey: string = generateIdempotencyKey()) =>
    api.post<LiveSafetyAppealReceipt>(`/api/v1/live-safety/${liveId}/appeal`, { message }, { idempotencyKey }),
};
