import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { OrdersRepository } from "../../orders/repositories/orders.repository.js";
import type { PaymentsRepository } from "../../payments/repositories/payments.repository.js";
import type { RewardableOrder } from "../models/loyalty.model.js";

export interface PayableCheckout {
  readonly id: string;
  readonly total: MinorUnits;
  readonly currency: CurrencyCode;
}

export interface LoyaltyCommerceLookup {
  findRewardableOrder(orderId: string): Promise<RewardableOrder | undefined>;
  countCompletedOrdersForBuyer(buyerId: string): Promise<number>;
  findPayableCheckoutForBuyer(buyerId: string, checkoutId: string): Promise<PayableCheckout | undefined>;
  hasPaymentAttempts(checkoutId: string): Promise<boolean>;
}

export class RepositoryLoyaltyCommerceLookup implements LoyaltyCommerceLookup {
  public constructor(private readonly orders: OrdersRepository, private readonly payments: PaymentsRepository, private readonly productCatalog: ProductCatalog) {}

  public async findRewardableOrder(orderId: string): Promise<RewardableOrder | undefined> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) return undefined;
    const products = await this.productCatalog.findProductSummaries(order.items.map((item) => item.productId));
    const categoryByProductId = new Map(products.map((product) => [product.id, product.categoryId ?? null]));
    return {
      id: order.id,
      buyerId: order.buyerId,
      storeId: order.storeId,
      currency: order.currency,
      total: order.total,
      items: order.items.map((item) => ({ productId: item.productId, categoryId: categoryByProductId.get(item.productId) ?? null, lineTotal: item.lineTotal })),
    };
  }

  public async countCompletedOrdersForBuyer(buyerId: string): Promise<number> {
    return (await this.orders.listAllForBuyer(buyerId, ["completed"])).length;
  }

  public async findPayableCheckoutForBuyer(buyerId: string, checkoutId: string): Promise<PayableCheckout | undefined> {
    const checkout = await this.orders.findCheckoutById(checkoutId);
    if (checkout === undefined || checkout.buyerId !== buyerId || checkout.status !== "pending") return undefined;
    return { id: checkout.id, total: checkout.total, currency: checkout.currency };
  }

  public async hasPaymentAttempts(checkoutId: string): Promise<boolean> {
    return (await this.payments.listForCheckout(checkoutId)).length > 0;
  }
}
