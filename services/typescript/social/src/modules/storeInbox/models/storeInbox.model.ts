import type { MessageView } from "../../messages/models/message.model.js";

export type StoreMessageSide = "customer" | "seller";

export interface StoreConversationParticipant {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface StoreConversationView {
  readonly id: string;
  readonly customer: StoreConversationParticipant;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly lastMessage: { readonly kind: string; readonly from: StoreMessageSide; readonly createdAt: string } | null;
  readonly unreadCount: number;
  readonly customerLastReadAt: string | null;
  readonly updatedAt: string;
}

export type StoreMessageView = MessageView & {
  readonly from: StoreMessageSide;
  readonly senderName: string;
};

export interface StoreConversationThreadView {
  readonly conversation: StoreConversationView;
  readonly messages: readonly StoreMessageView[];
  readonly nextCursor: string | null;
}

export interface StoreConversationPage {
  readonly data: readonly StoreConversationView[];
  readonly nextCursor: string | null;
  readonly unreadConversationsCount: number;
}

export const storeConversationKey = (storeId: string, buyerId: string): string => `store:${storeId}:${buyerId}`;
