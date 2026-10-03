export interface ConversationParticipant {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly from: "customer" | "seller";
  readonly senderName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface Conversation {
  readonly id: string;
  readonly customer: ConversationParticipant;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly lastMessage: { readonly body: string; readonly from: "customer" | "seller"; readonly createdAt: string } | null;
  readonly unreadCount: number;
  readonly updatedAt: string;
}

export interface ConversationThread {
  readonly conversation: Conversation;
  readonly messages: ConversationMessage[];
}
