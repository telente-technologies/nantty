import type { Conversation, NewChannelInput } from "@/types";

import { api } from "../core/apiClient.service";

export const channelsService = {
  createBroadcastChannel: (input: NewChannelInput) => api.post<Conversation>("/api/v1/channels", input),
  subscribeToChannel: (channelId: string) => api.post<Conversation>(`/api/v1/channels/${channelId}/subscribe`),
  unsubscribeFromChannel: (channelId: string) => api.delete<void>(`/api/v1/channels/${channelId}/subscribe`),
};
