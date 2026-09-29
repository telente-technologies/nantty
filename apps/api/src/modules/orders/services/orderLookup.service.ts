import type { AttributedOrderItem, OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import { SALE_STATUSES } from "../models/orders.model.js";
import type { OrdersRepository } from "../repositories/orders.repository.js";

const RECEIVED_STATUSES: readonly OrderStatus[] = ["delivered", "completed"];

export class RepositoryOrderLookup implements OrderLookup {
  public constructor(private readonly orders: OrdersRepository) {}

  public async hasReceivedProductInOrder(buyerId: string, orderId: string, productId: string): Promise<{ readonly storeId: string } | undefined> {
    const order = await this.orders.findById(orderId);
    if (order === undefined || order.buyerId !== buyerId || !RECEIVED_STATUSES.includes(order.status)) return undefined;
    return order.items.some((item) => item.productId === productId) ? { storeId: order.storeId } : undefined;
  }

  public async findReceivedOrderForProduct(buyerId: string, productId: string): Promise<{ readonly orderId: string; readonly storeId: string } | undefined> {
    const received = await this.orders.listAllForBuyer(buyerId, RECEIVED_STATUSES);
    const order = received.find((candidate) => candidate.items.some((item) => item.productId === productId));
    return order === undefined ? undefined : { orderId: order.id, storeId: order.storeId };
  }

  public async listStoreIdsBuyerHasPurchasedFrom(buyerId: string): Promise<readonly string[]> {
    const purchases = await this.orders.listAllForBuyer(buyerId, SALE_STATUSES);
    return [...new Set(purchases.map((order) => order.storeId))];
  }

  public async listAttributedOrderItems(orderId: string): Promise<readonly AttributedOrderItem[]> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) return [];
    return order.items.map((item) => ({
      orderId: order.id,
      storeId: order.storeId,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      currency: order.currency,
      attributionSource: item.attributionSource,
      attributionId: item.attributionId,
    }));
  }
}
