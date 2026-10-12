import { createRealtimeConnection, reconnectDelay, type RealtimeConnectionOptions as SharedConnectionOptions } from "@zudomart/web-kit/src/realtime/realtimeConnection";

import type { InboxRealtimeEvent } from "@/types/conversation.type";

export type { RealtimeTicket, TicketResult } from "@zudomart/web-kit/src/realtime/realtimeConnection";
export { reconnectDelay };

export type RealtimeConnectionOptions = Omit<SharedConnectionOptions<InboxRealtimeEvent>, "acceptsEvent" | "onSessionEnded" | "onTopicRejected" | "pauseWhenReplaced">;

const forwardedTypes = new Set(["message.created", "message.updated", "message.removed", "read", "typing", "subscriptions.revoked"]);

export function createInboxRealtimeConnection(options: RealtimeConnectionOptions) {
  return createRealtimeConnection<InboxRealtimeEvent>({ ...options, acceptsEvent: (type) => forwardedTypes.has(type) });
}
