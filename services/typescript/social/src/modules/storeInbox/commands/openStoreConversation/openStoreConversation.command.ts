export interface OpenStoreConversationCommand {
  readonly storeId: string;
  readonly buyerAccountId: string;
  readonly orderId?: string | undefined;
  readonly orderNumber?: string | undefined;
}
