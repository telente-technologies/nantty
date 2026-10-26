import { isMessageAfterSyncCursor } from "@/cache/messageHistory.type";
import { ApiError } from "@/errors/api.error";
import type { Conversation, Message, MessageEncryptionEnvelope, UserSummary } from "@/types";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryUserById, summariseUser } from "./userDirectory.mock";

export const mockChatUser = (userId: string): UserSummary => summariseUser(findDirectoryUserById(userId)!);

const directConversation = (id: string, peerId: string, lastMessage: string, hoursAgo: number, unread: number, isFriend: boolean): Conversation => ({
  id,
  peer: mockChatUser(peerId),
  lastMessage,
  lastMessageAt: isoDateHoursAgo(hoursAgo),
  unread,
  isFriend,
  kind: "direct",
  disappearingMessagesSeconds: null,
});

export const mockConversations: Conversation[] = [
  directConversation("c_1", "u_21", "Abeg send me the pictures of the aso-ebi when you can 🙏", 0.4, 3, true),
  {
    ...directConversation("c_2", "u_1", "Your order has been packed and will ship tomorrow morning", 2, 1, false),
    kind: "business",
    peer: { ...mockChatUser("u_1"), name: "Adaeze Styles" },
    store: { id: "s_ada", name: "Adaeze Styles", avatarUrl: null },
  },
  {
    ...directConversation("g_owambe", "u_21", "Blessing: Venue is confirmed for Saturday 🎉", 1, 5, true),
    kind: "group",
    title: null,
    encryptedAttributes: null,
    memberCount: 5,
    myRole: "owner",
  },
  {
    ...directConversation("ch_deals", "u_25", "Flash sale: free delivery on all orders above your city's threshold today", 5, 2, false),
    kind: "channel",
    title: "Nantty Deals",
    subscriberCount: 58200,
    myRole: "subscriber",
  },
  directConversation("c_3", "u_7", "Arsenal no go carry last this season, trust me", 8, 0, true),
  { ...directConversation("c_4", "u_2", "Yes, the earbuds come with a 1-year warranty", 30, 0, false), kind: "business", peer: { ...mockChatUser("u_2"), name: "TundeTech Gadgets" }, store: { id: "s_tunde", name: "TundeTech Gadgets", avatarUrl: null } },
  { ...directConversation("c_request_amaka", "u_13", "Loved your candles! Would you like to do a collab live next Friday?", 3, 1, false), inboxFolder: "requests" },
  {
    ...directConversation("c_spam_prize", "u_14", "Congrats! You won a free phone. Send your bank details to claim it.", 12, 1, false),
    inboxFolder: "spam",
    spamReason: "Flagged by Nantty because this account sent the same message to many people.",
  },
];

const textMessage = (id: string, conversationId: string, senderId: string, text: string, hoursAgo: number): Message => ({
  id,
  conversationId,
  senderId,
  text,
  createdAt: isoDateHoursAgo(hoursAgo),
  kind: "text",
  sender: senderId === "u_me" ? undefined : mockChatUser(senderId),
});

export const mockMessagesByConversation = new Map<string, Message[]>([
  [
    "c_1",
    [
      textMessage("m_c1_1", "c_1", "u_21", "Good evening dear, how far with the dress?", 1),
      textMessage("m_c1_2", "c_1", "u_me", "Almost ready! Tailor said Thursday latest", 0.8),
      textMessage("m_c1_3", "c_1", "u_21", "Abeg send me the pictures of the aso-ebi when you can 🙏", 0.4),
    ],
  ],
  [
    "c_2",
    [
      textMessage("m_c2_1", "c_2", "u_me", "Hi, is the Adire kaftan still available in size L?", 3),
      textMessage("m_c2_2", "c_2", "u_1", "Yes it is! I've reserved one for you.", 2.5),
      textMessage("m_c2_3", "c_2", "u_1", "Your order has been packed and will ship tomorrow morning", 2),
    ],
  ],
  [
    "g_owambe",
    [
      { ...textMessage("m_g_0", "g_owambe", "u_me", "Temitope created the group", 30), kind: "system" },
      textMessage("m_g_1", "g_owambe", "u_13", "Who's handling small chops? I fit bring puff-puff", 3),
      textMessage("m_g_2", "g_owambe", "u_10", "I know one caterer in Surulere, her jollof is elite 🔥", 2),
      textMessage("m_g_3", "g_owambe", "u_21", "Venue is confirmed for Saturday 🎉", 1),
    ],
  ],
  [
    "ch_deals",
    [
      textMessage("m_ch_1", "ch_deals", "u_25", "Welcome to Nantty Deals! We post the best verified offers here every day.", 48),
      textMessage("m_ch_2", "ch_deals", "u_25", "Flash sale: free delivery on all orders above your city's threshold today", 5),
    ],
  ],
]);

const fallbackPeer = () => mockChatUser("u_20");

export const findMockConversation = (conversationId: string): Conversation =>
  mockConversations.find((c) => c.id === conversationId) ?? directConversation(conversationId, fallbackPeer().id, "", 1, 0, false);

export function appendMockMessageAndUpdateConversation(message: Message) {
  mockMessagesByConversation.set(message.conversationId, [...(mockMessagesByConversation.get(message.conversationId) ?? []), message]);
  const index = mockConversations.findIndex((c) => c.id === message.conversationId);
  if (index >= 0) {
    const current = mockConversations[index]!;
    if (message.kind === "control") return message;
    mockConversations[index] = { ...current, lastMessage: message.encryption?.ciphertext ? "" : message.text, lastMessageAt: message.createdAt };
  }
  return message;
}

function moveMockConversationToChats(conversationId: string): Conversation {
  const index = mockConversations.findIndex((c) => c.id === conversationId);
  if (index < 0) throw new ApiError(404, "This conversation no longer exists.", "CONVERSATION_NOT_FOUND");
  mockConversations[index] = { ...mockConversations[index]!, inboxFolder: "chats", spamReason: null };
  return mockConversations[index]!;
}

const withExpiryForConversation = (conversationId: string, createdAt: string) => {
  const seconds = findMockConversation(conversationId).disappearingMessagesSeconds;
  return seconds ? new Date(new Date(createdAt).getTime() + seconds * 1000).toISOString() : null;
};

interface SendMessageBody {
  readonly kind?: NonNullable<Message["kind"]>;
  readonly mediaId?: string;
  readonly durationSeconds?: number;
  readonly encryption?: MessageEncryptionEnvelope;
  readonly text?: unknown;
  readonly location?: unknown;
  readonly poll?: unknown;
  readonly document?: unknown;
  readonly sharedContent?: unknown;
}

const plaintextFields = ["text", "location", "poll", "document", "sharedContent"] as const;
const mediaKinds = new Set<string>(["voice", "image", "video"]);
const sendableKinds = new Set<string>(["text", "voice", "image", "video", "document", "location", "liveLocation", "poll", "shared", "control"]);

export function rejectMockPlaintext(input: Partial<Record<(typeof plaintextFields)[number], unknown>>) {
  const sent = plaintextFields.filter((field) => input[field] !== undefined && input[field] !== null && input[field] !== "");
  if (sent.length > 0) {
    throw new ApiError(422, "Chats are end-to-end encrypted. Update Nantty to send this: text, locations, polls, documents and shared items must be inside the encrypted message.", "PLAINTEXT_NOT_ACCEPTED");
  }
}

const people = ["u_20", "u_21", "u_7", "u_10", "u_13", "u_11", "u_14", "u_19"].map(mockChatUser);

export const chatsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/conversations", ({ query }) => {
    const folder = query.get("folder") ?? "chats";
    const inFolder = mockConversations.filter((c) => (c.inboxFolder ?? "chats") === folder);
    return query.get("filter") === "direct" ? inFolder.filter((c) => (c.kind ?? "direct") === "direct") : inFolder;
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/accept", ({ params }) => moveMockConversationToChats(params.conversationId!)),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/not-spam", ({ params }) => moveMockConversationToChats(params.conversationId!)),
  createMockRoute("DELETE", "/api/v1/conversations/:conversationId", ({ params }) => {
    const index = mockConversations.findIndex((c) => c.id === params.conversationId);
    if (index >= 0) mockConversations.splice(index, 1);
    mockMessagesByConversation.delete(params.conversationId!);
  }),
  createMockRoute("GET", "/api/v1/conversations/search", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return {
      conversations: mockConversations
        .filter((c) => c.kind !== "group" && (c.title ?? c.peer.name).toLowerCase().includes(term))
        .map((c) => ({ id: c.id, peer: c.peer, snippet: c.lastMessage })),
      people: people.filter((p) => p.name.toLowerCase().includes(term)),
    };
  }),
  createMockRoute("GET", "/api/v1/conversations/:conversationId", ({ params }) => findMockConversation(params.conversationId!)),
  createMockRoute("GET", "/api/v1/conversations/:conversationId/messages", ({ params, query }) => {
    const allMessages = mockMessagesByConversation.get(params.conversationId!) ?? [];
    const afterCursor = query.get("after");
    return {
      data: afterCursor ? allMessages.filter((message) => isMessageAfterSyncCursor(message, afterCursor)) : allMessages,
      nextCursor: null,
    };
  }),
  createMockRoute("POST", "/api/v1/conversations", ({ body }) => {
    const { userId } = body as { userId: string };
    const existing = mockConversations.find((c) => (c.kind ?? "direct") === "direct" && c.peer.id === userId);
    if (existing) return existing;
    const peer = people.find((p) => p.id === userId) ?? fallbackPeer();
    const conversation: Conversation = { id: `c_${userId}`, peer, lastMessage: "", lastMessageAt: new Date().toISOString(), unread: 0, isFriend: false, kind: "direct" };
    mockConversations.push(conversation);
    return conversation;
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/messages", ({ params, body }) => {
    const input = (body ?? {}) as SendMessageBody;
    const kind = input.kind ?? "text";
    rejectMockPlaintext(input);
    if (!input.encryption?.ciphertext) throw new ApiError(422, "Every chat message needs an encryption envelope.", "ENCRYPTION_REQUIRED");
    if (!sendableKinds.has(kind)) throw new ApiError(422, "This message kind can't be sent.", "KIND_NOT_ALLOWED");
    if ((mediaKinds.has(kind) || kind === "document") && !input.mediaId) throw new ApiError(422, "This message needs a media id.", "MEDIA_REQUIRED");
    if (!mediaKinds.has(kind) && kind !== "document" && input.mediaId) throw new ApiError(422, "This message kind has no media.", "MEDIA_NOT_ALLOWED");
    const existing = mockMessagesByConversation.get(params.conversationId!) ?? [];
    if (kind === "control" && existing.length === 0) throw new ApiError(422, "There's no message here to react to or update yet.", "NOTHING_TO_UPDATE");
    const createdAt = new Date().toISOString();
    return appendMockMessageAndUpdateConversation({
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId: params.conversationId!,
      senderId: getSignedInMockUser().id,
      text: "",
      encryption: { deviceId: input.encryption.deviceId, ciphertext: input.encryption.ciphertext, protocol: input.encryption.protocol ?? "signal-v1" },
      createdAt,
      kind,
      media: mediaKinds.has(kind) && input.mediaId ? { id: input.mediaId, type: kind as "voice" | "image" | "video", url: null, ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}) } : null,
      document: kind === "document" ? { url: null } : null,
      expiresAt: withExpiryForConversation(params.conversationId!, createdAt),
    });
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/read", ({ params }) => {
    const index = mockConversations.findIndex((c) => c.id === params.conversationId);
    if (index >= 0) mockConversations[index] = { ...mockConversations[index]!, unread: 0 };
  }),
  createMockRoute("GET", "/api/v1/search/people", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(term) || p.username.includes(term));
  }),
];
