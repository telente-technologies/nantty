import type { AttachmentPointer, ChatControl, ChatLocation, ChatPoll } from "@nantty/chat-crypto";

export interface ConversationParticipant {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export type ConversationMessageKind = "text" | "voice" | "image" | "video" | "system" | "shared" | "location" | "liveLocation" | "document" | "poll" | "control";
export type ConversationSide = "customer" | "seller";

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly kind: ConversationMessageKind;
  readonly from: ConversationSide;
  readonly senderName: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string | null; readonly protocol: string } | null;
  readonly media: { readonly id: string; readonly type: "voice" | "image" | "video"; readonly url: string | null; readonly durationSeconds?: number } | null;
  readonly document: { readonly url: string | null } | null;
  readonly linkPreview: string | null;
  readonly moderationHidden: boolean;
  readonly clientMessageId: string | null;
}

export interface DecryptedConversationMessage extends ConversationMessage {
  readonly text: string;
  readonly attachment: AttachmentPointer | null;
  readonly location: ChatLocation | null;
  readonly poll: ChatPoll | null;
  readonly control: ChatControl | null;
  readonly sharedReference: { readonly kind: string; readonly id: string } | null;
  readonly decryptionNotice: string | null;
  readonly pending?: boolean;
  readonly failed?: boolean;
  readonly pendingLabel?: string | null;
}

export interface Conversation {
  readonly id: string;
  readonly customer: ConversationParticipant;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly lastMessage: { readonly kind: ConversationMessageKind; readonly from: ConversationSide; readonly createdAt: string } | null;
  readonly unreadCount: number;
  readonly customerLastReadAt?: string | null;
  readonly updatedAt: string;
}

export interface ConversationThread {
  readonly conversation: Conversation;
  readonly messages: ConversationMessage[];
  readonly nextCursor: string | null;
}

export interface ConversationRecipients {
  readonly userIds: readonly string[];
  readonly storeTeamUserIds: readonly string[];
}

export interface DecryptedPreview {
  readonly text: string;
  readonly createdAt: string;
}

export type InboxRealtimeStatus = "connecting" | "live" | "polling";

export type InboxRealtimeEvent =
  | { readonly type: "message.created"; readonly conversationId: string; readonly message?: { readonly id: string; readonly senderId: string; readonly kind: ConversationMessageKind } }
  | { readonly type: "message.updated" | "message.removed"; readonly conversationId: string; readonly messageId?: string }
  | { readonly type: "read"; readonly conversationId: string; readonly readerId: string; readonly lastReadAt: string }
  | { readonly type: "typing"; readonly conversationId: string; readonly isTyping: boolean; readonly user?: { readonly id?: string } }
  | { readonly type: "subscriptions.revoked"; readonly topics: readonly string[] };
