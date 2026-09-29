export const CONVERSATION_KINDS = ["direct", "group", "channel", "business"] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];
export type ParticipantRole = "owner" | "admin" | "member" | "subscriber" | "customer";
export type MessageKind = "text" | "voice" | "image" | "system";

export const SYSTEM_SENDER_ID = "system";

export interface MessageMediaItem {
  readonly url: string;
  readonly type: "image" | "video";
}

export interface ConversationRecord {
  readonly id: string;
  readonly kind: ConversationKind;
  readonly pairKey: string | null;
  readonly title: string | null;
  readonly description: string;
  readonly photoMediaId: string | null;
  readonly ownerId: string | null;
  readonly storeId: string | null;
  readonly disappearingMessagesSeconds: number | null;
  readonly memberCount: number;
  readonly lastMessageAt: Date;
  readonly createdAt: Date;
}

export type NewConversation = Omit<ConversationRecord, "id" | "memberCount" | "lastMessageAt" | "createdAt">;

export interface ParticipantRecord {
  readonly conversationId: string;
  readonly userId: string;
  readonly role: ParticipantRole;
  readonly lastReadAt: Date;
  readonly joinedAt: Date;
}

export interface NewParticipant {
  readonly userId: string;
  readonly role: ParticipantRole;
}

export type ConversationSettingsChanges = Partial<Pick<ConversationRecord, "title" | "photoMediaId" | "disappearingMessagesSeconds" | "ownerId">>;

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderStoreId: string | null;
  readonly kind: MessageKind;
  readonly text: string;
  readonly media: readonly MessageMediaItem[];
  readonly voiceMediaId: string | null;
  readonly voiceDurationSeconds: number | null;
  readonly expiresAt: Date | null;
  readonly hiddenAt: Date | null;
  readonly createdAt: Date;
}

export type NewMessage = Omit<MessageRecord, "id" | "createdAt" | "hiddenAt">;

export interface ReactionRecord {
  readonly messageId: string;
  readonly userId: string;
  readonly emoji: string;
  readonly createdAt: Date;
}

export interface MessageSyncPosition {
  readonly createdAt: Date;
  readonly messageId: string;
}

export function createDirectConversationPairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(":");
}

export function createBusinessConversationPairKey(storeId: string, customerId: string): string {
  return `store:${storeId}:${customerId}`;
}

export function isMessageVisibleAt(message: MessageRecord, now: Date): boolean {
  return message.hiddenAt === null && (message.expiresAt === null || message.expiresAt > now);
}

export function isAdministratorRole(role: ParticipantRole | undefined): boolean {
  return role === "owner" || role === "admin";
}
