import type { Product } from "@/types/catalog.type";
import type { CurrencyCode, Money } from "@/types/money.type";
import type { OnlineOrder, OnlineOrderStatus, OrderDispute, ReturnRequest } from "@/types/order.type";
import { buildStoreScopedRecordId, type DemoOnlineOrderPlan } from "@/mocks/seed/demoStoreProfile.mock";
import { buildDemoDeliveryDetails, buildDemoOrderTimeline, buildDemoPaymentReference, convertOrderStatusToEscrowStatus, pickOrderStatusForAge } from "@/mocks/seed/demoOrderLifecycle.mock";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

function computeDemoProcessingFeeMinor(totalMinor: number): number {
  const flatMinor = totalMinor < 250_000 ? 0 : 10_000;
  return Math.min(200_000, Math.round(totalMinor * 0.015) + flatMinor);
}

export interface DemoOnlineOrderOptions {
  readonly plan: DemoOnlineOrderPlan;
  readonly randomSeed: number;
  readonly recordKey: string | null;
  readonly currency: CurrencyCode;
}

export function buildDemoOnlineOrders(products: readonly Product[], options: DemoOnlineOrderOptions): OnlineOrder[] {
  const { plan, recordKey } = options;
  const toStoreMoney = (amountMinor: number): Money => ({ amountMinor, currency: options.currency });
  const random = createSeededRandomNumberGenerator(options.randomSeed);
  const onlineProducts = products.filter((product) => product.publishedOnline);
  const orders: OnlineOrder[] = [];
  for (let orderIndex = 0; orderIndex < plan.orderCount; orderIndex += 1) {
    const daysAgo = Math.floor((orderIndex * plan.historyLengthInDays) / plan.orderCount);
    const buyer = pickRandomItem(plan.buyers, random);
    const lineCount = pickRandomIntegerInclusive(1, 3, random);
    const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
      const product = pickRandomItem(onlineProducts, random);
      const variant = pickRandomItem(product.variants, random);
      const quantity = pickRandomIntegerInclusive(1, 2, random);
      return {
        id: buildStoreScopedRecordId("ordl", recordKey, `${orderIndex}_${lineIndex}`),
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantTitle: variant.title,
        sku: variant.sku,
        imageUrl: product.images[0]?.url ?? null,
        quantity,
        unitPrice: variant.price,
        lineTotal: toStoreMoney(variant.price.amountMinor * quantity),
      };
    });
    const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0);
    const shippingMinor = buyer.state === plan.homeState ? plan.shippingFeeMinor.homeState : plan.shippingFeeMinor.otherStates;
    const status: OnlineOrderStatus = orderIndex === plan.disputedOrderIndex ? "disputed" : pickOrderStatusForAge(daysAgo, random);
    const createdAt = buildIsoDateDaysAgo(daysAgo, pickRandomIntegerInclusive(8, 21, random), pickRandomIntegerInclusive(0, 59, random));
    const isShippedOrLater = ["shipped", "delivered", "completed", "disputed", "returned"].includes(status);
    const escrowStatus = convertOrderStatusToEscrowStatus(status);
    const orderNumber = `ZM-${String(plan.firstOrderNumber + orderIndex)}`;
    const orderKey = buildStoreScopedRecordId("o", recordKey, orderIndex + 1);
    const courier = isShippedOrLater ? pickRandomItem(["GIG Logistics", "Kwik Delivery", "DHL Nigeria", "Sendbox"], random) : null;
    const paymentProvider = orderIndex % 3 === 0 ? ("paystack" as const) : ("flutterwave" as const);
    const isFailedAttempt = status === "shipped" && random() < 0.25;
    const isRefunded = status === "refunded" || status === "returned" || status === "cancelled";
    const buyerPhone = "+23480" + String(30000000 + orderIndex * 7919).slice(0, 8);
    const creator = plan.creators.length > 0 && random() < plan.creatorShare ? pickRandomItem(plan.creators, random) : null;
    orders.push({
      id: buildStoreScopedRecordId("ord", recordKey, String(orderIndex + 1).padStart(4, "0")),
      orderNumber,
      invoiceNumber: `INV-${orderNumber.replace("ZM-", "")}`,
      buyer: { id: buyer.id, name: buyer.name, username: buyer.username, phone: buyerPhone },
      shippingAddress: { recipientName: buyer.name, phone: buyerPhone, line1: `${pickRandomIntegerInclusive(2, 90, random)} Market Road`, city: buyer.city, state: buyer.state, country: "NG" },
      lines,
      subtotal: toStoreMoney(subtotalMinor),
      shippingFee: toStoreMoney(shippingMinor),
      total: toStoreMoney(subtotalMinor + shippingMinor),
      sellerPayout: toStoreMoney(subtotalMinor + shippingMinor - Math.round(((subtotalMinor + shippingMinor) * 150) / 10_000) - computeDemoProcessingFeeMinor(subtotalMinor + shippingMinor)),
      paymentMode: "escrow",
      escrowFee: toStoreMoney(Math.round(((subtotalMinor + shippingMinor) * 150) / 10_000)),
      escrowFeeBasisPoints: 150,
      paymentProcessingFee: toStoreMoney(computeDemoProcessingFeeMinor(subtotalMinor + shippingMinor)),
      status,
      escrowStatus,
      escrowReleaseAt: status === "delivered" ? buildIsoDateDaysAgo(daysAgo - 3) : null,
      fulfilment: isShippedOrLater
        ? { courier: courier ?? "GIG Logistics", trackingNumber: `TRK${pickRandomIntegerInclusive(10000000, 99999999, random)}`, trackingUrl: null, shippedAt: buildIsoDateDaysAgo(Math.max(daysAgo - 1, 0), 15), fromLocationId: plan.fulfilmentLocationId }
        : null,
      attributedCreator: creator,
      createdAt,
      deliveredAt: ["delivered", "completed", "disputed"].includes(status) ? buildIsoDateDaysAgo(Math.max(daysAgo - 3, 0), 13) : null,
      paymentStatus: isRefunded ? "refunded" : "paid",
      paymentProvider,
      paymentReference: buildDemoPaymentReference(paymentProvider, orderNumber, random),
      paidAt: createdAt,
      refundedAmount: toStoreMoney(isRefunded ? subtotalMinor + shippingMinor : 0),
      refunds: isRefunded ? [{ id: `rf_${orderKey}`, amount: toStoreMoney(subtotalMinor + shippingMinor), reason: status === "returned" ? "Item returned" : status === "cancelled" ? "Order cancelled" : "Out of stock after payment", createdAt: buildIsoDateDaysAgo(Math.max(daysAgo - 2, 0), 12) }] : [],
      delivery: buildDemoDeliveryDetails(status, daysAgo, isFailedAttempt, random),
      timeline: buildDemoOrderTimeline({ orderKey, status, daysAgo, buyerName: buyer.name, courier, sellerName: "You" }),
      notes: orderIndex % 9 === 0 ? [{ id: `note_${orderKey}`, body: "Buyer asked for gift wrapping — add a thank-you card.", authorName: "Store team", createdAt: buildIsoDateDaysAgo(daysAgo, 12) }] : [],
      conversationId: orderIndex < 14 ? buildStoreScopedRecordId("conv", recordKey, `order_${orderIndex + 1}`) : null,
    });
  }
  return orders.reverse();
}

export function buildDemoReturnRequests(orders: readonly OnlineOrder[], plan: DemoOnlineOrderPlan, recordKey: string | null): ReturnRequest[] {
  return orders
    .filter((order) => order.status === "delivered" || order.status === "completed")
    .slice(0, Math.min(3, plan.returnReasons.length))
    .map((order, index) => {
      const firstLine = order.lines[0];
      return {
        id: buildStoreScopedRecordId("ret", recordKey, index + 1),
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer.name,
        lines: firstLine ? [{ orderLineId: firstLine.id, name: firstLine.name, quantity: 1 }] : [],
        reason: plan.returnReasons[index] ?? "Other",
        status: (["requested", "approved", "refunded"] as const)[index] ?? "requested",
        refundAmount: firstLine?.unitPrice ?? { amountMinor: 0, currency: order.total.currency },
        createdAt: buildIsoDateDaysAgo(index + 1, 11),
      };
    });
}

export function buildDemoDisputes(orders: readonly OnlineOrder[], plan: DemoOnlineOrderPlan, recordKey: string | null): OrderDispute[] {
  return orders
    .filter((order) => order.status === "disputed")
    .map((order, index) => ({
      id: buildStoreScopedRecordId("dsp", recordKey, index + 1),
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.buyer.name,
      reason: "Item not as described",
      amount: order.total,
      status: "awaiting_seller",
      respondBy: buildIsoDateDaysAgo(-2, 18),
      messages: [
        { id: "dm_1", from: "buyer", body: plan.disputeBuyerMessage, createdAt: buildIsoDateDaysAgo(1, 10) },
        { id: "dm_2", from: "zudomart", body: "We have paused escrow release. Seller, please respond with photos of the packed item within 48 hours.", createdAt: buildIsoDateDaysAgo(1, 12) },
      ],
      openedAt: buildIsoDateDaysAgo(1, 10),
    }));
}
