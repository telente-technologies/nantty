export interface OrderLookup {
  hasReceivedProductInOrder(buyerId: string, orderId: string, productId: string): Promise<{ readonly storeId: string } | undefined>;
}
