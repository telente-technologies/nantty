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
  readonly lastMessage: { readonly body: string; readonly from: StoreMessageSide; readonly createdAt: string } | null;
  readonly unreadCount: number;
  readonly updatedAt: string;
}

export interface StoreMessageView {
  readonly id: string;
  readonly conversationId: string;
  readonly from: StoreMessageSide;
  readonly senderName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface StoreConversationThreadView {
  readonly conversation: StoreConversationView;
  readonly messages: readonly StoreMessageView[];
}

export interface StoreConversationPage {
  readonly data: readonly StoreConversationView[];
  readonly nextCursor: string | null;
  readonly unreadConversationsCount: number;
}

export const storePlaintextProtocol = "store-plaintext-v1";

export const storeConversationKey = (storeId: string, buyerId: string): string => `store:${storeId}:${buyerId}`;
