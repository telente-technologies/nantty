import type { Product } from "@/types/catalog.type";
import type { Money } from "@/types/money.type";
import type { OnlineOrder, OnlineOrderStatus, OrderDispute, ReturnRequest } from "@/types/order.type";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

const demoBuyers = [
  { id: "usr_b01", name: "Chioma Nnaji", username: "chioma.styles", city: "Enugu", state: "Enugu" },
  { id: "usr_b02", name: "Yemi Adebayo", username: "yemi.adebayo", city: "Ibadan", state: "Oyo" },
  { id: "usr_b03", name: "Musa Danjuma", username: "musadanjuma", city: "Kano", state: "Kano" },
  { id: "usr_b04", name: "Esther Etim", username: "esther.etim", city: "Uyo", state: "Akwa Ibom" },
  { id: "usr_b05", name: "Tobi Ajayi", username: "tobi.ajayi", city: "Lekki", state: "Lagos" },
  { id: "usr_b06", name: "Grace Odum", username: "graceodum", city: "Port Harcourt", state: "Rivers" },
  { id: "usr_b07", name: "Sani Abubakar", username: "sani.abu", city: "Kaduna", state: "Kaduna" },
  { id: "usr_b08", name: "Bisi Coker", username: "bisicoker", city: "Yaba", state: "Lagos" },
];

const demoCreators = [
  { id: "usr_cr1", username: "stylewithtemi" },
  { id: "usr_cr2", username: "techbro.dami" },
];

function naira(amountMinor: number): Money {
  return { amountMinor, currency: "NGN" };
}

function pickStatusForAge(daysAgo: number, random: () => number): OnlineOrderStatus {
  if (daysAgo <= 1) return random() < 0.6 ? "paid" : "processing";
  if (daysAgo <= 4) return pickRandomItem<OnlineOrderStatus>(["processing", "shipped", "shipped", "delivered"], random);
  if (daysAgo <= 8) return pickRandomItem<OnlineOrderStatus>(["shipped", "delivered", "completed", "completed"], random);
  return pickRandomItem<OnlineOrderStatus>(["completed", "completed", "completed", "completed", "cancelled", "refunded"], random);
}

export function buildDemoOnlineOrders(products: readonly Product[]): OnlineOrder[] {
  const random = createSeededRandomNumberGenerator(777);
  const onlineProducts = products.filter((product) => product.publishedOnline);
  const orders: OnlineOrder[] = [];
  for (let orderIndex = 0; orderIndex < 48; orderIndex += 1) {
    const daysAgo = Math.floor((orderIndex * 45) / 48);
    const buyer = pickRandomItem(demoBuyers, random);
    const lineCount = pickRandomIntegerInclusive(1, 3, random);
    const lines = Array.from({ length: lineCount }, (_, lineIndex) => {
      const product = pickRandomItem(onlineProducts, random);
      const variant = pickRandomItem(product.variants, random);
      const quantity = pickRandomIntegerInclusive(1, 2, random);
      return {
        id: `ordl_${orderIndex}_${lineIndex}`,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantTitle: variant.title,
        sku: variant.sku,
        imageUrl: product.images[0]?.url ?? null,
        quantity,
        unitPrice: variant.price,
        lineTotal: naira(variant.price.amountMinor * quantity),
      };
    });
    const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0);
    const shippingMinor = buyer.state === "Lagos" ? 250_000 : 450_000;
    const status = orderIndex === 5 ? "disputed" : pickStatusForAge(daysAgo, random);
    const createdAt = buildIsoDateDaysAgo(daysAgo, pickRandomIntegerInclusive(8, 21, random), pickRandomIntegerInclusive(0, 59, random));
    const isShippedOrLater = ["shipped", "delivered", "completed", "disputed"].includes(status);
    const escrowStatus = status === "completed" ? "released" : status === "refunded" || status === "cancelled" ? "refunded" : status === "disputed" ? "disputed" : "held";
    const creator = random() < 0.2 ? pickRandomItem(demoCreators, random) : null;
    orders.push({
      id: `ord_${String(orderIndex + 1).padStart(4, "0")}`,
      orderNumber: `ZM-${String(58210 + orderIndex)}`,
      buyer: { id: buyer.id, name: buyer.name, username: buyer.username },
      shippingAddress: { recipientName: buyer.name, phone: "+23480" + String(30000000 + orderIndex * 7919).slice(0, 8), line1: `${pickRandomIntegerInclusive(2, 90, random)} Market Road`, city: buyer.city, state: buyer.state, country: "NG" },
      lines,
      subtotal: naira(subtotalMinor),
      shippingFee: naira(shippingMinor),
      total: naira(subtotalMinor + shippingMinor),
      sellerPayout: naira(Math.round(subtotalMinor * 0.95)),
      status,
      escrowStatus,
      escrowReleaseAt: status === "delivered" ? buildIsoDateDaysAgo(daysAgo - 3) : null,
      fulfilment: isShippedOrLater
        ? { courier: pickRandomItem(["GIG Logistics", "Kwik Delivery", "DHL Nigeria", "Sendbox"], random), trackingNumber: `TRK${pickRandomIntegerInclusive(10000000, 99999999, random)}`, trackingUrl: null, shippedAt: buildIsoDateDaysAgo(Math.max(daysAgo - 1, 0), 15), fromLocationId: "loc_apapa" }
        : null,
      attributedCreator: creator,
      createdAt,
      deliveredAt: ["delivered", "completed"].includes(status) ? buildIsoDateDaysAgo(Math.max(daysAgo - 3, 0), 13) : null,
    });
  }
  return orders.reverse();
}

export function buildDemoReturnRequests(orders: readonly OnlineOrder[]): ReturnRequest[] {
  return orders
    .filter((order) => order.status === "delivered" || order.status === "completed")
    .slice(0, 3)
    .map((order, index) => {
      const firstLine = order.lines[0];
      return {
        id: `ret_${index + 1}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer.name,
        lines: firstLine ? [{ orderLineId: firstLine.id, name: firstLine.name, quantity: 1 }] : [],
        reason: ["Wrong size delivered", "Item arrived scratched", "Changed my mind"][index] ?? "Other",
        status: (["requested", "approved", "refunded"] as const)[index] ?? "requested",
        refundAmount: firstLine?.unitPrice ?? naira(0),
        createdAt: buildIsoDateDaysAgo(index + 1, 11),
      };
    });
}

export function buildDemoDisputes(orders: readonly OnlineOrder[]): OrderDispute[] {
  return orders
    .filter((order) => order.status === "disputed")
    .map((order, index) => ({
      id: `dsp_${index + 1}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.buyer.name,
      reason: "Item not as described",
      amount: order.total,
      status: "awaiting_seller",
      respondBy: buildIsoDateDaysAgo(-2, 18),
      messages: [
        { id: "dm_1", from: "buyer", body: "The bag colour is darker than the photos and the strap is missing.", createdAt: buildIsoDateDaysAgo(1, 10) },
        { id: "dm_2", from: "zudomart", body: "We have paused escrow release. Seller, please respond with photos of the packed item within 48 hours.", createdAt: buildIsoDateDaysAgo(1, 12) },
      ],
      openedAt: buildIsoDateDaysAgo(1, 10),
    }));
}
