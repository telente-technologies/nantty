import { ApiError } from "@/errors/api.error";
import type { ChatMuteDuration, ChatSettings, SharedContentCard, SharedContentKind } from "@/types";

import { mockConversations } from "./chats.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

let mockChatSettings: ChatSettings = {
  messageRequestsFrom: "everyone",
  preventDirectGroupAdds: false,
  notifications: { messages: true, requests: true, groups: true, streakReminders: true, showMessagePreview: true },
};

const legacyCopy = {
  reactions: "Reactions are now end-to-end encrypted. Update Nantty to react to messages.",
  pollVotes: "Poll votes are now end-to-end encrypted. Update Nantty to vote.",
  liveLocation: "Live locations are now end-to-end encrypted. Update Nantty to share your location.",
} as const;

const gone = (feature: keyof typeof legacyCopy) => () => {
  throw new ApiError(410, legacyCopy[feature], "ENCRYPTED_CLIENT_REQUIRED");
};

const sharedKinds = new Set<string>(["post", "clip", "story", "product", "live", "store", "profile", "order"]);

function mockSharedCard(kind: SharedContentKind, id: string): SharedContentCard {
  if (id.startsWith("gone")) return { reference: { kind, id }, availability: "unavailable", title: "", subtitle: null, imageUrl: null };
  if (kind === "order") return { reference: { kind, id }, availability: "available", title: "Order ZM-1042", subtitle: "3 items · shipped", imageUrl: null, priceLabel: "₦54,000" };
  return { reference: { kind, id }, availability: "available", title: `Shared ${kind}`, subtitle: kind === "product" ? "Adaeze Styles" : null, imageUrl: null, ...(kind === "product" ? { priceLabel: "₦18,500", stock: 4 } : {}), isLive: kind === "live" };
}

function muteUntil(duration: ChatMuteDuration, now: Date): string | null {
  if (duration === "off") return null;
  if (duration === "always") return "always";
  return new Date(now.getTime() + (duration === "8h" ? 8 * 3_600_000 : 7 * 86_400_000)).toISOString();
}

export const chatE2eeMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/chat/settings", () => mockChatSettings),
  createMockRoute("PATCH", "/api/v1/chat/settings", ({ body }) => {
    const update = (body ?? {}) as { messageRequestsFrom?: ChatSettings["messageRequestsFrom"]; preventDirectGroupAdds?: boolean; notifications?: Partial<ChatSettings["notifications"]> };
    mockChatSettings = { messageRequestsFrom: update.messageRequestsFrom ?? mockChatSettings.messageRequestsFrom, preventDirectGroupAdds: update.preventDirectGroupAdds ?? mockChatSettings.preventDirectGroupAdds, notifications: { ...mockChatSettings.notifications, ...update.notifications } };
    return mockChatSettings;
  }),
  createMockRoute("GET", "/api/v1/chat/content", ({ query }) => {
    const kind = query.get("kind") ?? "";
    const id = query.get("id") ?? "";
    if (!sharedKinds.has(kind) || !id) throw new ApiError(400, "Choose something to show.", "VALIDATION_FAILED");
    return mockSharedCard(kind as SharedContentKind, id);
  }),
  createMockRoute("PUT", "/api/v1/conversations/:conversationId/mute", ({ params, body }) => {
    const duration = (body as { duration?: ChatMuteDuration } | null)?.duration ?? "off";
    const index = mockConversations.findIndex((conversation) => conversation.id === params.conversationId);
    if (index < 0) throw new ApiError(404, "This conversation no longer exists.", "CONVERSATION_NOT_FOUND");
    const mutedUntil = muteUntil(duration, new Date());
    mockConversations[index] = { ...mockConversations[index]!, mutedUntil };
    return { mutedUntil };
  }),
  createMockRoute("POST", "/api/v1/messages/:messageId/reactions", gone("reactions")),
  createMockRoute("DELETE", "/api/v1/messages/:messageId/reactions/:emoji", gone("reactions")),
  createMockRoute("POST", "/api/v1/messages/:messageId/poll-votes", gone("pollVotes")),
  createMockRoute("PATCH", "/api/v1/messages/:messageId/location", gone("liveLocation")),
  createMockRoute("POST", "/api/v1/messages/:messageId/live-location/stop", gone("liveLocation")),
];
