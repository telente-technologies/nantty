import type { Conversation, NewChannelInput } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const channelsService = {
  createBroadcastChannel: (input: NewChannelInput) =>
    sendRequestToWebappServer<Conversation>("/api/v1/channels", { method: "POST", body: input }),
};
