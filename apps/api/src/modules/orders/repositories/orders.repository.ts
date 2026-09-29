import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CheckoutRecord, CheckoutStatus, NewOrder, OrderRecord, OrderStatusChange } from "../models/orders.model.js";

export interface OrdersRepository {
  createCheckoutWithOrders(buyerId: string, chargeCurrency: CurrencyCode, orders: readonly NewOrder[]): Promise<{ checkout: CheckoutRecord; orders: readonly OrderRecord[] }>;
  findCheckoutById(checkoutId: string): Promise<CheckoutRecord | undefined>;
  changeCheckoutStatus(checkoutId: string, from: CheckoutStatus, to: CheckoutStatus): Promise<boolean>;
  findById(orderId: string): Promise<OrderRecord | undefined>;
  listByCheckout(checkoutId: string): Promise<readonly OrderRecord[]>;
  listForBuyer(buyerId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest): Promise<Page<OrderRecord>>;
  listForStore(storeId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest, searchTerm?: string): Promise<Page<OrderRecord>>;
  listAllForBuyer(buyerId: string, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]>;
  transitionStatus(orderId: string, from: readonly OrderStatus[], to: OrderStatus, change: OrderStatusChange): Promise<OrderRecord | undefined>;
  listStoreOrdersPaidSince(storeId: string, since: Date, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]>;
}

export class InMemoryOrdersRepository implements OrdersRepository {
  private readonly checkouts = new Map<string, CheckoutRecord>();
  private readonly orders = new Map<string, OrderRecord>();

  public async createCheckoutWithOrders(buyerId: string, chargeCurrency: CurrencyCode, orders: readonly NewOrder[]) {
    const now = new Date();
    const total = orders.reduce((sum, order) => sum + order.chargeTotal, 0);
    const checkout: CheckoutRecord = { id: randomUUID(), buyerId, currency: chargeCurrency, status: "pending", total, createdAt: now };
    this.checkouts.set(checkout.id, checkout);
    const created = orders.map((order) => {
      const orderId = randomUUID();
      const record: OrderRecord = {
        ...order,
        id: orderId,
        checkoutId: checkout.id,
        trackingNumber: null,
        courier: null,
        paidAt: null,
        shippedAt: null,
        deliveredAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: now,
        items: order.items.map((item) => ({ ...item, id: randomUUID(), orderId })),
      };
      this.orders.set(orderId, record);
      return record;
    });
    return { checkout, orders: created };
  }

  public async findCheckoutById(checkoutId: string): Promise<CheckoutRecord | undefined> {
    return this.checkouts.get(checkoutId);
  }

  public async changeCheckoutStatus(checkoutId: string, from: CheckoutStatus, to: CheckoutStatus): Promise<boolean> {
    const checkout = this.checkouts.get(checkoutId);
    if (checkout?.status !== from) return false;
    this.checkouts.set(checkoutId, { ...checkout, status: to });
    return true;
  }

  public async findById(orderId: string): Promise<OrderRecord | undefined> {
    return this.orders.get(orderId);
  }

  public async listByCheckout(checkoutId: string): Promise<readonly OrderRecord[]> {
    return [...this.orders.values()].filter((order) => order.checkoutId === checkoutId);
  }

  public async listForBuyer(buyerId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest): Promise<Page<OrderRecord>> {
    return this.listMatching((order) => order.buyerId === buyerId && (statuses === undefined || statuses.includes(order.status)), page);
  }

  public async listForStore(storeId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest, searchTerm?: string): Promise<Page<OrderRecord>> {
    const needle = searchTerm?.toLowerCase();
    return this.listMatching(
      (order) =>
        order.storeId === storeId &&
        (statuses === undefined || statuses.includes(order.status)) &&
        (needle === undefined || order.number.toLowerCase().includes(needle) || order.customerName.toLowerCase().includes(needle)),
      page,
    );
  }

  public async listAllForBuyer(buyerId: string, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]> {
    return [...this.orders.values()].filter((order) => order.buyerId === buyerId && statuses.includes(order.status)).sort(compareByNewestFirst);
  }

  public async transitionStatus(orderId: string, from: readonly OrderStatus[], to: OrderStatus, change: OrderStatusChange): Promise<OrderRecord | undefined> {
    const order = this.orders.get(orderId);
    if (order === undefined || !from.includes(order.status)) return undefined;
    const updated: OrderRecord = { ...order, ...change, status: to };
    this.orders.set(orderId, updated);
    return updated;
  }

  public async listStoreOrdersPaidSince(storeId: string, since: Date, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]> {
    return [...this.orders.values()].filter(
      (order) => order.storeId === storeId && order.paidAt !== null && order.paidAt >= since && statuses.includes(order.status),
    );
  }

  private listMatching(matches: (order: OrderRecord) => boolean, page: PageRequest): Page<OrderRecord> {
    return paginateSortedItems([...this.orders.values()].filter(matches).sort(compareByNewestFirst), page);
  }
}
