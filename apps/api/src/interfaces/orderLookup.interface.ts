export interface OrderLookup {
  hasReceivedProductInOrder(buyerId: string, orderId: string, productId: string): Promise<{ readonly storeId: string } | undefined>;
  findReceivedOrderForProduct(buyerId: string, productId: string): Promise<{ readonly orderId: string; readonly storeId: string } | undefined>;
  listStoreIdsBuyerHasPurchasedFrom(buyerId: string): Promise<readonly string[]>;
}
