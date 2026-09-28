export interface MessageMediaItem {
  readonly url: string;
  readonly type: "image" | "video";
}

export interface ConversationRecord {
  readonly id: string;
  readonly kind: "direct";
  readonly pairKey: string;
  readonly participantIds: readonly string[];
  readonly lastMessageAt: Date;
  readonly createdAt: Date;
}

export interface ParticipantRecord {
  readonly conversationId: string;
  readonly userId: string;
  readonly lastReadAt: Date;
}

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly media: readonly MessageMediaItem[];
  readonly createdAt: Date;
}

export interface NewMessage {
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly media: readonly MessageMediaItem[];
}

export function createDirectConversationPairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(":");
}
