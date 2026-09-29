import type { OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { OrdersRepository } from "../repositories/orders.repository.js";

export class RepositoryOrderLookup implements OrderLookup {
  public constructor(private readonly orders: OrdersRepository) {}

  public async hasReceivedProductInOrder(buyerId: string, orderId: string, productId: string): Promise<{ readonly storeId: string } | undefined> {
    const order = await this.orders.findById(orderId);
    if (order === undefined || order.buyerId !== buyerId) return undefined;
    if (order.status !== "delivered" && order.status !== "completed") return undefined;
    return order.items.some((item) => item.productId === productId) ? { storeId: order.storeId } : undefined;
  }
}
