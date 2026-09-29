import { randomBytes } from "node:crypto";

import type { EventBus } from "@zudojs/events";

import { chooseChargeCurrencyForDisplayCurrency } from "../../../configs/currency.config.js";
import { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AddressBook } from "../../../interfaces/addressBook.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { ProductCatalog, StockLine } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { applyLockedExchangeRate } from "../../../utils/lockedRate.util.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { CartsService } from "../../carts/services/carts.service.js";
import { OrderCancelledEvent, OrderDeliveredEvent, OrderPaidEvent, OrderPlacedEvent, OrderShippedEvent } from "../events/orderPlaced.event.js";
import { INTERNAL_STATUSES_FOR_PUBLIC_STATUS, type CheckoutRecord, type NewOrder, type OrderRecord, type PublicOrderStatus } from "../models/orders.model.js";
import type { OrdersRepository } from "../repositories/orders.repository.js";

export interface OrdersDependencies {
  readonly orders: OrdersRepository;
  readonly addressBook: AddressBook;
  readonly carts: CartsService;
  readonly productCatalog: ProductCatalog;
  readonly storeAccess: StoreAccess;
  readonly cipher: FieldCipher;
  readonly clock: Clock;
  readonly events: EventBus;
  readonly currencyConverter: CurrencyConverter;
}

export interface CheckoutResult {
  readonly checkout: CheckoutRecord;
  readonly orders: readonly OrderRecord[];
}

const STORE_STAFF = [StoreRole.OWNER, StoreRole.MANAGER, StoreRole.STAFF];

function createOrderNumber(now: Date): string {
  return `ZM${now.toISOString().slice(0, 10).replaceAll("-", "")}${randomBytes(3).toString("hex").toUpperCase()}`;
}

function convertOrderToStockLines(order: OrderRecord): readonly StockLine[] {
  return order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
}

export class OrdersService {
  public constructor(public readonly dependencies: OrdersDependencies) {}

  public async placeOrdersFromCart(buyerId: string, addressId: string, displayCurrency: CurrencyCode): Promise<CheckoutResult> {
    const { carts, productCatalog, orders, cipher, clock, events, currencyConverter, addressBook } = this.dependencies;
    const address = await addressBook.findOwnedShippingAddress(buyerId, addressId);
    if (address === undefined) throw notFound("Address");
    const cart = await carts.buildPricedCartForUser(buyerId);
    if (cart.unavailableLines.length > 0) throw unprocessable("Some items in your cart are no longer available in that quantity. Review your cart.");
    if (cart.groups.length === 0) throw unprocessable("Your cart is empty.");
    const stockLines = cart.groups.flatMap((group) => group.lines.map((line) => ({ variantId: line.variant.variantId, quantity: line.quantity })));
    await productCatalog.reserveStock(stockLines);
    const now = clock.now();
    const shippingAddress = {
      fullName: address.fullName,
      phoneEncrypted: await cipher.encryptText(address.phone),
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      country: address.country,
    };
    const chargeCurrency = chooseChargeCurrencyForDisplayCurrency(displayCurrency);
    const newOrders: NewOrder[] = [];
    for (const group of cart.groups) {
      const lockedRate = await currencyConverter.quoteExchangeRate(group.store.currency, chargeCurrency);
      newOrders.push({
        number: createOrderNumber(now),
        buyerId,
        storeId: group.store.id,
        status: "pending_payment",
        currency: group.store.currency,
        itemsTotal: group.itemsTotal.amountMinor,
        discountTotal: group.shopDiscount.amountMinor,
        shippingTotal: group.shipping.amountMinor,
        total: group.total.amountMinor,
        chargeCurrency,
        chargeTotal: applyLockedExchangeRate(group.total, lockedRate).amountMinor,
        exchangeRate: lockedRate.scaledRate,
        rateLockedAt: lockedRate.quotedAt,
        shippingAddress,
        customerName: address.fullName,
        items: group.lines.map((line) => ({
          productId: line.variant.productId,
          variantId: line.variant.variantId,
          title: line.variant.title,
          size: line.variant.size,
          color: line.variant.color,
          imageUrl: line.variant.imageUrl,
          unitPrice: line.unitPrice.amountMinor,
          quantity: line.quantity,
          lineTotal: line.lineTotal.amountMinor,
          attributionSource: line.attribution?.source ?? null,
          attributionId: line.attribution?.id ?? null,
        })),
      });
    }
    let result: CheckoutResult;
    try {
      result = await orders.createCheckoutWithOrders(buyerId, chargeCurrency, newOrders);
    } catch (error) {
      await productCatalog.releaseStock(stockLines);
      throw error;
    }
    await carts.dependencies.carts.removeLines(buyerId, stockLines.map((line) => line.variantId));
    for (const order of result.orders) await publishEvent(events, OrderPlacedEvent, { orderId: order.id, buyerId, storeId: order.storeId });
    return result;
  }

  public async findOrderForBuyer(buyerId: string, orderId: string): Promise<OrderRecord> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === undefined || order.buyerId !== buyerId) throw notFound("Order");
    return order;
  }

  public async findOrderForBuyerOrStoreMember(userId: string, orderId: string): Promise<OrderRecord> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === undefined) throw notFound("Order");
    if (order.buyerId === userId) return order;
    const memberStoreIds = await this.dependencies.storeAccess.listStoreIdsForMember(userId);
    if (!memberStoreIds.includes(order.storeId)) throw notFound("Order");
    return order;
  }

  public async findOrderForStoreMember(userId: string, orderId: string): Promise<OrderRecord> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === undefined) throw notFound("Order");
    await this.dependencies.storeAccess.assertStoreMember(userId, order.storeId, STORE_STAFF);
    return order;
  }

  public listBuyerOrders(buyerId: string, status: PublicOrderStatus | undefined, page: PageRequest): Promise<Page<OrderRecord>> {
    return this.dependencies.orders.listForBuyer(buyerId, status === undefined ? undefined : INTERNAL_STATUSES_FOR_PUBLIC_STATUS[status], page);
  }

  public async listSellerOrders(
    userId: string,
    requestedStoreId: string | undefined,
    status: PublicOrderStatus | undefined,
    searchTerm: string | undefined,
    page: PageRequest,
  ): Promise<Page<OrderRecord>> {
    const storeId = await resolveSellerStoreIdForUser(this.dependencies.storeAccess, userId, requestedStoreId, STORE_STAFF);
    const statuses = status === undefined ? undefined : INTERNAL_STATUSES_FOR_PUBLIC_STATUS[status];
    return this.dependencies.orders.listForStore(storeId, statuses, page, searchTerm);
  }

  public async cancelOrderBeforePayment(buyerId: string, orderId: string): Promise<OrderRecord> {
    const { orders, productCatalog, clock, events } = this.dependencies;
    const order = await this.findOrderForBuyer(buyerId, orderId);
    const cancelled = await orders.transitionStatus(order.id, ["pending_payment"], "cancelled", { cancelledAt: clock.now() });
    if (cancelled === undefined) throw invalidState("Only unpaid orders can be cancelled.");
    await productCatalog.releaseStock(convertOrderToStockLines(order));
    const siblings = await orders.listByCheckout(order.checkoutId);
    if (siblings.every((sibling) => sibling.status === "cancelled")) await orders.changeCheckoutStatus(order.checkoutId, "pending", "cancelled");
    await publishEvent(events, OrderCancelledEvent, { orderId, buyerId, storeId: order.storeId });
    return cancelled;
  }

  public async markOrderShipped(userId: string, orderId: string, trackingNumber: string | null): Promise<OrderRecord> {
    const { storeId } = await this.findOrderForStoreMember(userId, orderId);
    const shipped = await this.dependencies.orders.transitionStatus(orderId, ["paid"], "shipped", { shippedAt: this.dependencies.clock.now(), trackingNumber });
    if (shipped === undefined) throw invalidState("Only paid orders can be marked as shipped.");
    await this.notifyBuyer(shipped, "Your order is on its way", `Order ${shipped.number} has been shipped.`);
    await publishEvent(this.dependencies.events, OrderShippedEvent, { orderId, buyerId: shipped.buyerId, storeId });
    return shipped;
  }

  public async markOrderDelivered(userId: string, orderId: string): Promise<OrderRecord> {
    const { storeId } = await this.findOrderForStoreMember(userId, orderId);
    const delivered = await this.dependencies.orders.transitionStatus(orderId, ["shipped"], "delivered", { deliveredAt: this.dependencies.clock.now() });
    if (delivered === undefined) throw invalidState("Only shipped orders can be marked as delivered.");
    await this.notifyBuyer(delivered, "Your order was delivered", `Confirm receipt of order ${delivered.number} or open a dispute if something is wrong.`);
    await publishEvent(this.dependencies.events, OrderDeliveredEvent, { orderId, buyerId: delivered.buyerId, storeId });
    return delivered;
  }

  public async markCheckoutOrdersPaid(checkoutId: string): Promise<readonly OrderRecord[]> {
    const { orders, productCatalog, clock, events, storeAccess } = this.dependencies;
    const paidAt = clock.now();
    const paid: OrderRecord[] = [];
    for (const order of await orders.listByCheckout(checkoutId)) {
      const updated = await orders.transitionStatus(order.id, ["pending_payment"], "paid", { paidAt });
      if (updated === undefined) continue;
      paid.push(updated);
      await productCatalog.recordSales(updated.items.map((item) => ({ productId: item.productId, quantity: item.quantity })));
      await publishEvent(events, OrderPaidEvent, { orderId: updated.id, buyerId: updated.buyerId, storeId: updated.storeId });
    }
    await orders.changeCheckoutStatus(checkoutId, "pending", "paid");
    const stores = await storeAccess.findStoreSummaries(paid.map((order) => order.storeId));
    for (const order of paid) {
      const owner = stores.find((store) => store.id === order.storeId)?.ownerId;
      if (owner !== undefined) {
        await publishEvent(events, NotificationRequestedEvent, { userId: owner, category: "orders", title: "New order", body: `Order ${order.number} was paid. Ship it soon.`, data: { orderId: order.id } });
      }
    }
    return paid;
  }

  public async decryptShippingPhone(order: OrderRecord): Promise<string> {
    return this.dependencies.cipher.decryptText(order.shippingAddress.phoneEncrypted);
  }

  private notifyBuyer(order: OrderRecord, title: string, body: string): Promise<void> {
    return publishEvent(this.dependencies.events, NotificationRequestedEvent, { userId: order.buyerId, category: "orders", title, body, data: { orderId: order.id } });
  }
}
