import type { ChatSettings, Conversation, InboxFolder, MessageRequestAudience } from "@/types";

import { readStreakForViewer } from "./chatStreakEngine.mock";
import { followedUserIds, followerUserIds } from "./socialGraph.mock";

export interface SenderBehaviorMetadata {
  readonly recipientsLastHour: number;
  readonly accountAgeDays: number;
  readonly duplicateMessageRatio: number;
}

export let chatSettingsState: ChatSettings = {
  messageRequestsFrom: "everyone",
  preventDirectGroupAdds: false,
  notifications: {
    messages: true,
    requests: true,
    groups: true,
    streakReminders: true,
    showMessagePreview: true,
    sound: true,
    vibration: true,
    bubbles: false,
    bubbleMode: "selected",
    bubbleConversationIds: [],
    bubbleExcludedConversationIds: [],
  },
};

export const updateChatSettingsState = (update: Partial<ChatSettings>) => {
  chatSettingsState = { ...chatSettingsState, ...update, notifications: { ...chatSettingsState.notifications, ...update.notifications } };
  return chatSettingsState;
};

export const senderBehaviorByConversationId: Readonly<Record<string, SenderBehaviorMetadata>> = {
  c_req_1: { recipientsLastHour: 2, accountAgeDays: 410, duplicateMessageRatio: 0 },
  c_req_2: { recipientsLastHour: 4, accountAgeDays: 90, duplicateMessageRatio: 0.1 },
  c_req_3: { recipientsLastHour: 6, accountAgeDays: 35, duplicateMessageRatio: 0.2 },
  c_spam_1: { recipientsLastHour: 214, accountAgeDays: 2, duplicateMessageRatio: 0.97 },
  c_spam_2: { recipientsLastHour: 63, accountAgeDays: 1, duplicateMessageRatio: 0.85 },
};

const requestSenderByConversationId: Readonly<Record<string, string>> = {
  c_req_1: "u_20",
  c_req_2: "u_9",
  c_req_3: "u_16",
  c_spam_1: "u_18",
  c_spam_2: "u_24",
};

const peerAudienceByUserId: Readonly<Record<string, MessageRequestAudience>> = { u_20: "followers", u_14: "nobody", u_10: "following" };

const acceptedConversationIds = new Set<string>();
const deletedConversationIds = new Set<string>();
const notSpamConversationIds = new Set<string>();
const mutedUntilByConversationId = new Map<string, string>();

export const isFlaggedBySenderBehaviour = (behavior: SenderBehaviorMetadata) =>
  behavior.recipientsLastHour >= 50 || (behavior.accountAgeDays < 3 && behavior.recipientsLastHour >= 20) || behavior.duplicateMessageRatio >= 0.8;

const describeSpamReason = (behavior: SenderBehaviorMetadata) =>
  behavior.duplicateMessageRatio >= 0.8
    ? `Sent near-identical messages to ${behavior.recipientsLastHour} accounts in the last hour`
    : `New account messaging ${behavior.recipientsLastHour} people in the last hour`;

export const isIncomingRequestAllowedByMyAudience = (senderId: string) => {
  const audience = chatSettingsState.messageRequestsFrom;
  if (audience === "everyone") return true;
  if (audience === "nobody") return false;
  return audience === "following" ? followedUserIds.has(senderId) : followerUserIds.includes(senderId);
};

export const isOutgoingRequestAllowedByPeer = (peerId: string) => {
  const audience = peerAudienceByUserId[peerId] ?? "everyone";
  if (audience === "everyone") return true;
  if (audience === "nobody") return false;
  return audience === "followers" ? followedUserIds.has(peerId) : followerUserIds.includes(peerId);
};

export const isConversationHidden = (conversationId: string) => deletedConversationIds.has(conversationId);

export const folderForConversation = (conversation: Conversation): InboxFolder => {
  const behavior = senderBehaviorByConversationId[conversation.id];
  if (!behavior || acceptedConversationIds.has(conversation.id)) return "chats";
  const senderId = requestSenderByConversationId[conversation.id];
  if (senderId && !isIncomingRequestAllowedByMyAudience(senderId)) return "chats";
  return isFlaggedBySenderBehaviour(behavior) && !notSpamConversationIds.has(conversation.id) ? "spam" : "requests";
};

export const isHiddenByMessageRequestAudience = (conversation: Conversation) => {
  const senderId = requestSenderByConversationId[conversation.id];
  return !!senderId && !acceptedConversationIds.has(conversation.id) && !isIncomingRequestAllowedByMyAudience(senderId);
};

export const acceptMessageRequestState = (conversationId: string) => void acceptedConversationIds.add(conversationId);
export const deleteConversationState = (conversationId: string) => void deletedConversationIds.add(conversationId);
export const markNotSpamState = (conversationId: string) => void notSpamConversationIds.add(conversationId);

const MUTE_DURATION_MS = { "8h": 8 * 3_600_000, "1w": 7 * 86_400_000 } as const;

export const applyMuteState = (conversationId: string, duration: "8h" | "1w" | "always" | "off") => {
  if (duration === "off") mutedUntilByConversationId.delete(conversationId);
  else mutedUntilByConversationId.set(conversationId, duration === "always" ? "always" : new Date(Date.now() + MUTE_DURATION_MS[duration]).toISOString());
  return mutedUntilByConversationId.get(conversationId) ?? null;
};

const readActiveMute = (conversationId: string) => {
  const mutedUntil = mutedUntilByConversationId.get(conversationId);
  if (!mutedUntil || mutedUntil === "always") return mutedUntil ?? null;
  return mutedUntil > new Date().toISOString() ? mutedUntil : null;
};

export const decorateConversation = (conversation: Conversation): Conversation => {
  const behavior = senderBehaviorByConversationId[conversation.id];
  const folder = folderForConversation(conversation);
  return {
    ...conversation,
    inboxFolder: folder,
    spamReason: folder === "spam" && behavior ? describeSpamReason(behavior) : null,
    streak: (conversation.kind ?? "direct") === "direct" ? readStreakForViewer(conversation.id) : null,
    mutedUntil: readActiveMute(conversation.id),
  };
};
