import type { Conversation, Message, UserSummary } from "@/types";

import { ApiError } from "@/errors/api.error";

import { buildAttachmentSeedMessages, buildMessagePreviewText, buildPollFromInput, type PollInput } from "./chatAttachments.mock";
import { buildExpiredMediaSeedMessages, buildLinkSeedMessages } from "./chatRichSeedMessages.mock";
import { decorateConversation, isConversationHidden, isHiddenByMessageRequestAudience, isOutgoingRequestAllowedByPeer } from "./chatInboxState.mock";
import { conversationHasStreak, recordStreakSendByMe, seedStreak } from "./chatStreakEngine.mock";
import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { notifyMentionedUsers, sanitizeMentionsForWrite } from "./mentionRules.mock";
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
    store: { id: "s_ada", name: "Adaeze Styles" },
  },
  {
    ...directConversation("g_owambe", "u_21", "Blessing: Venue is confirmed for Saturday 🎉", 1, 5, true),
    kind: "group",
    title: "Owambe Planning Squad",
    memberCount: 5,
    myRole: "owner",
  },
  {
    ...directConversation("ch_deals", "u_25", "Flash sale: free delivery on all orders above your city's threshold today", 5, 2, false),
    kind: "channel",
    title: "Zudomart Deals",
    subscriberCount: 58200,
    myRole: "subscriber",
  },
  directConversation("c_3", "u_7", "Arsenal no go carry last this season, trust me", 8, 0, true),
  { ...directConversation("c_4", "u_2", "Yes, the earbuds come with a 1-year warranty", 30, 0, false), kind: "business", store: { id: "s_tunde", name: "TundeTech Gadgets" } },
  directConversation("c_susp", "u_22", "Thanks, I'll send the invoice tomorrow", 48, 0, true),
  directConversation("c_req_1", "u_20", "Hi! I saw your store, do you ship to Abuja?", 3, 1, false),
  directConversation("c_req_2", "u_9", "Hello, I'd love to shoot your next collection", 6, 1, false),
  directConversation("c_req_3", "u_16", "Please can I get the price list?", 12, 2, false),
  directConversation("c_spam_1", "u_18", "WIN a free iPhone! Tap the link now", 1, 1, false),
  directConversation("c_spam_2", "u_24", "Earn 50k daily from home, reply YES", 2, 1, false),
];

seedStreak("c_1", "u_21", { count: 99, daysSinceCounted: 1, peerSentToday: true });
seedStreak("c_3", "u_7", { count: 23, daysSinceCounted: 2, peerSentToday: false });
const outgoingRequestConversationIds = new Set<string>();

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
      ...buildExpiredMediaSeedMessages("c_1", "u_21", textMessage),
      ...buildLinkSeedMessages("c_1", "u_21", textMessage),
      ...buildAttachmentSeedMessages("c_1", "u_21", textMessage),
      textMessage("m_c1_1", "c_1", "u_21", "Good evening dear, how far with the dress?", 1),
      { ...textMessage("m_c1_2", "c_1", "u_me", "Almost ready! Tailor said Thursday latest", 0.8), readAt: isoDateHoursAgo(0.7) },
      textMessage("m_c1_3", "c_1", "u_21", "Abeg send me the pictures of the aso-ebi when you can 🙏", 0.4),
    ],
  ],
  [
    "c_susp",
    [
      textMessage("m_cs_1", "c_susp", "u_22", "Is the car mat set still available?", 50),
      textMessage("m_cs_2", "c_susp", "u_me", "Yes, it is. I can ship tomorrow.", 49),
      textMessage("m_cs_3", "c_susp", "u_22", "Thanks, I'll send the invoice tomorrow", 48),
    ],
  ],
  ["c_req_1", [textMessage("m_rq1", "c_req_1", "u_20", "Hi! I saw your store, do you ship to Abuja?", 3)]],
  ["c_req_2", [textMessage("m_rq2", "c_req_2", "u_9", "Hello, I'd love to shoot your next collection", 6)]],
  ["c_req_3", [textMessage("m_rq3", "c_req_3", "u_16", "Please can I get the price list?", 12)]],
  ["c_spam_1", [textMessage("m_sp1", "c_spam_1", "u_18", "WIN a free iPhone! Tap the link now", 1)]],
  ["c_spam_2", [textMessage("m_sp2", "c_spam_2", "u_24", "Earn 50k daily from home, reply YES", 2)]],
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
      {
        ...textMessage("m_ch_1", "ch_deals", "u_25", "Welcome to Zudomart Deals! We post the best verified offers here every day.", 48),
        reactions: [{ emoji: "👍", count: 1204, reactedByMe: false }],
      },
      {
        ...textMessage("m_ch_2", "ch_deals", "u_25", "Flash sale: free delivery on all orders above your city's threshold today", 5),
        reactions: [
          { emoji: "🔥", count: 3102, reactedByMe: false },
          { emoji: "❤️", count: 845, reactedByMe: true },
        ],
      },
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
    mockConversations[index] = { ...current, lastMessage: buildMessagePreviewText(message), lastMessageAt: message.createdAt };
  }
  return message;
}

const withExpiryForConversation = (conversationId: string, createdAt: string) => {
  const seconds = findMockConversation(conversationId).disappearingMessagesSeconds;
  return seconds ? new Date(new Date(createdAt).getTime() + seconds * 1000).toISOString() : null;
};

const people = ["u_20", "u_21", "u_7", "u_10", "u_13", "u_11", "u_14", "u_19"].map(mockChatUser);

export const chatsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/conversations", ({ query }) => {
    const folder = query.get("folder") ?? "chats";
    return mockConversations
      .filter((c) => !isConversationHidden(c.id) && !isHiddenByMessageRequestAudience(c))
      .map(decorateConversation)
      .filter((c) => c.inboxFolder === folder && (query.get("filter") !== "direct" || (c.isFriend && (c.kind ?? "direct") === "direct")));
  }),
  createMockRoute("GET", "/api/v1/conversations/search", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return {
      conversations: mockConversations
        .filter((c) => (c.title ?? c.peer.name).toLowerCase().includes(term) || c.lastMessage.toLowerCase().includes(term))
        .map((c) => ({ id: c.id, peer: c.peer, snippet: c.lastMessage })),
      people: people.filter((p) => p.name.toLowerCase().includes(term)),
    };
  }),
  createMockRoute("GET", "/api/v1/conversations/:conversationId", ({ params }) => decorateConversation(findMockConversation(params.conversationId!))),
  createMockRoute("GET", "/api/v1/conversations/:conversationId/messages", ({ params, query }) => {
    const allMessages = mockMessagesByConversation.get(params.conversationId!) ?? [];
    const afterIndex = allMessages.findIndex((message) => message.id === query.get("after"));
    return {
      data: afterIndex >= 0 ? allMessages.slice(afterIndex + 1) : allMessages,
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
    outgoingRequestConversationIds.add(conversation.id);
    return conversation;
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/messages", ({ params, body }) => {
    const input = body as { text: string; kind?: "voice" | "image" | "shared" | "location" | "liveLocation" | "document" | "poll"; location?: Message["location"]; document?: Message["document"]; poll?: PollInput; mediaId?: string; durationSeconds?: number; linkPreview?: Message["linkPreview"]; sharedContent?: Message["sharedContent"]; mentions?: Message["mentions"] };
    const conversation = findMockConversation(params.conversationId!);
    if (outgoingRequestConversationIds.has(conversation.id) && !isOutgoingRequestAllowedByPeer(conversation.peer.id)) {
      throw new ApiError(403, `${conversation.peer.name} isn't accepting message requests from you`);
    }
    const createdAt = new Date().toISOString();
    const media =
      input.kind === "voice" && input.mediaId
        ? { id: input.mediaId, type: "voice" as const, url: null, durationSeconds: input.durationSeconds }
        : input.kind === "image" && input.mediaId
          ? { id: input.mediaId, type: "image" as const, url: null }
          : null;
    const isGroupConversation = conversation.kind === "group";
    const sanitizedMentions = sanitizeMentionsForWrite(getSignedInMockUser(), input.mentions, isGroupConversation ? "group" : "direct", conversation.id);
    if (isGroupConversation) notifyMentionedUsers(getSignedInMockUser(), sanitizedMentions, "group", conversation.id);
    if (conversationHasStreak(conversation.id)) recordStreakSendByMe(conversation.id);
    return appendMockMessageAndUpdateConversation({
      id: `m_${Date.now()}`,
      conversationId: params.conversationId!,
      senderId: getSignedInMockUser().id,
      text: input.text,
      createdAt,
      ...(sanitizedMentions.mentions.length ? { mentions: sanitizedMentions.mentions } : {}),
      kind: input.kind ?? "text",
      media,
      mediaExpiresAt: media || input.document ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
      location: input.location ? { ...input.location, updatedAt: createdAt } : null,
      document: input.document ?? null,
      poll: input.poll ? buildPollFromInput(input.poll) : null,
      linkPreview: input.linkPreview ?? null,
      sharedContent: input.sharedContent ?? null,
      encryption: { deviceId: "mock-device-1", ciphertext: null, protocol: "signal-v1-pending" },
      expiresAt: withExpiryForConversation(params.conversationId!, createdAt),
    });
  }),
  createMockRoute("POST", "/api/v1/conversations/:conversationId/read", ({ params }) => {
    if (decorateConversation(findMockConversation(params.conversationId!)).inboxFolder !== "chats") return;
    const index = mockConversations.findIndex((c) => c.id === params.conversationId);
    if (index >= 0) mockConversations[index] = { ...mockConversations[index]!, unread: 0 };
  }),
  createMockRoute("GET", "/api/v1/search/people", ({ query }) => {
    const term = (query.get("q") ?? "").toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(term) || p.username.includes(term));
  }),
];
