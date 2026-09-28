import type { Conversation, Message } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo, me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const conversations: Conversation[] = [
  { id: "c_1", peer: buildMockUserSummary(11, "Freda Dickinson"), lastMessage: "Pirate ipsum arrgh bounty warp jack buffalo side", lastMessageAt: isoDateHoursAgo(3), unread: 12900, isFriend: true },
  { id: "c_2", peer: buildMockUserSummary(12, "Carlos Trantow"), lastMessage: "Pizza ipsum dolor meat lovers buffalo jack wrap.", lastMessageAt: isoDateHoursAgo(3), unread: 12, isFriend: false },
  { id: "c_3", peer: buildMockUserSummary(13, "Freda Dickinson"), lastMessage: "Pirate ipsum arrgh bounty warp jack buffalo side", lastMessageAt: isoDateHoursAgo(3), unread: 1, isFriend: true },
  { id: "c_4", peer: buildMockUserSummary(14, "Carlos Trantow"), lastMessage: "Pizza ipsum dolor meat lovers buffalo jack wrap.", lastMessageAt: isoDateHoursAgo(3), unread: 0, isFriend: false },
];

const enyo = { ...buildMockUserSummary(20, "Enyo Dev"), username: "mayweda_dev" };
const messagesByConversation = new Map<string, Message[]>([
  [
    "c_enyo",
    [
      { id: "m_1", conversationId: "c_enyo", senderId: me.id, text: "Hi, how are you!", createdAt: isoDateHoursAgo(1) },
      {
        id: "m_2",
        conversationId: "c_enyo",
        senderId: me.id,
        text: "have you coded the designs on the file yet, i already sent them to you for coding",
        createdAt: isoDateHoursAgo(1),
      },
    ],
  ],
]);

const findConversation = (conversationId: string): Conversation =>
  conversations.find((c) => c.id === conversationId) ?? {
    id: conversationId,
    peer: enyo,
    lastMessage: "",
    lastMessageAt: isoDateHoursAgo(1),
    unread: 0,
    isFriend: false,
  };

const people = [enyo, buildMockUserSummary(21, "Freda"), buildMockUserSummary(22, "Olise"), buildMockUserSummary(23, "Carlos")];

export const chatsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/conversations", ({ query }) =>
    query.get("filter") === "direct" ? conversations.filter((c) => c.isFriend) : conversations,
  ),
  createMockRoute("GET", "/api/v1/conversations/search", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return {
      conversations: conversations
        .filter((c) => c.peer.name.toLowerCase().includes(term) || c.lastMessage.toLowerCase().includes(term))
        .map((c) => ({ id: c.id, peer: c.peer, snippet: c.lastMessage })),
      people: people.filter((p) => p.name.toLowerCase().includes(term)),
    };
  }),
  createMockRoute("GET", "/api/v1/conversations/:conversationId", ({ params }) => findConversation(params.conversationId!)),
  createMockRoute("GET", "/api/v1/conversations/:conversationId/messages", ({ params }) => ({
    data: messagesByConversation.get(params.conversationId!) ?? [],
    nextCursor: null,
  })),
  createMockRoute("POST", "/api/v1/conversations", ({ body }) => {
    const { userId } = body as { userId: string };
    const peer = people.find((p) => p.id === userId) ?? enyo;
    return { id: `c_${userId}`, peer, lastMessage: "", lastMessageAt: new Date().toISOString(), unread: 0, isFriend: false };
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/messages", ({ params, body }) => {
    const message: Message = {
      id: `m_${Date.now()}`,
      conversationId: params.conversationId!,
      senderId: me.id,
      text: (body as { text: string }).text,
      createdAt: new Date().toISOString(),
    };
    messagesByConversation.set(params.conversationId!, [...(messagesByConversation.get(params.conversationId!) ?? []), message]);
    return message;
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/read", () => undefined),
  createMockRoute("GET", "/api/v1/search/people", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(term) || p.username.includes(term));
  }),
];
