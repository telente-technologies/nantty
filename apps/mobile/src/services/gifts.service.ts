import type { LiveGift, SendLiveGiftInput, SentLiveGiftReceipt } from "@/types";

import { api, generateIdempotencyKey } from "./apiClient.service";

export const giftsService = {
  fetchLiveGiftCatalog: () => api.get<LiveGift[]>("/api/v1/gifts"),
  sendGiftToLive: (liveId: string, input: SendLiveGiftInput, idempotencyKey = generateIdempotencyKey()) =>
    api.post<SentLiveGiftReceipt>(`/api/v1/lives/${liveId}/gifts`, input, { idempotencyKey }),
};
