import type { DeliveryStatus } from "@/types/delivery.type";
import type { EscrowStatus, OnlineOrderStatus, OrderDeliveryDetails, OrderTimelineEvent } from "@/types/order.type";
import { buildIsoDateDaysAgo, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

const demoRiders = [
  { name: "Sunday Okon", phone: "+2348031234401" },
  { name: "Abubakar Sani", phone: "+2348061234402" },
  { name: "Femi Lawal", phone: "+2348091234403" },
  { name: "Emeka Obi", phone: "+2348121234404" },
];

export function pickOrderStatusForAge(daysAgo: number, random: () => number): OnlineOrderStatus {
  if (daysAgo <= 1) return pickRandomItem<OnlineOrderStatus>(["new", "new", "new", "processing", "ready"], random);
  if (daysAgo <= 4) return pickRandomItem<OnlineOrderStatus>(["processing", "ready", "shipped", "shipped", "delivered"], random);
  if (daysAgo <= 8) return pickRandomItem<OnlineOrderStatus>(["shipped", "delivered", "completed", "completed"], random);
  return pickRandomItem<OnlineOrderStatus>(["completed", "completed", "completed", "completed", "completed", "cancelled", "refunded", "returned"], random);
}

export function convertOrderStatusToEscrowStatus(status: OnlineOrderStatus): EscrowStatus {
  if (status === "completed") return "released";
  if (status === "refunded" || status === "cancelled" || status === "returned") return "refunded";
  if (status === "disputed") return "disputed";
  return "held";
}

export function convertOrderStatusToDeliveryStatus(status: OnlineOrderStatus): DeliveryStatus {
  const deliveryStatusByOrderStatus: Record<OnlineOrderStatus, DeliveryStatus> = {
    new: "pending",
    processing: "preparing",
    ready: "ready_for_pickup",
    shipped: "in_transit",
    delivered: "delivered",
    completed: "delivered",
    cancelled: "cancelled",
    returned: "returned",
    refunded: "cancelled",
    disputed: "delivered",
  };
  return deliveryStatusByOrderStatus[status];
}

export function buildDemoDeliveryDetails(status: OnlineOrderStatus, daysAgo: number, isFailedAttempt: boolean, random: () => number): OrderDeliveryDetails {
  const rider = ["ready", "shipped", "delivered", "completed", "disputed"].includes(status) ? pickRandomItem(demoRiders, random) : null;
  if (isFailedAttempt) {
    return { status: "failed", riderName: rider?.name ?? null, riderPhone: rider?.phone ?? null, estimatedDeliveryAt: buildIsoDateDaysAgo(-1, 16), attempts: 2, lastAttemptNote: pickRandomItem(["Buyer not reachable on phone", "Address could not be found", "Buyer asked to come back tomorrow"], random) };
  }
  const deliveryStatus = convertOrderStatusToDeliveryStatus(status);
  const isAwaitingDelivery = deliveryStatus === "in_transit" || deliveryStatus === "ready_for_pickup" || deliveryStatus === "preparing" || deliveryStatus === "pending";
  return {
    status: deliveryStatus,
    riderName: rider?.name ?? null,
    riderPhone: rider?.phone ?? null,
    estimatedDeliveryAt: isAwaitingDelivery ? buildIsoDateDaysAgo(Math.min(daysAgo, 0) - pickRandomIntegerInclusive(1, 3, random), 17) : null,
    attempts: deliveryStatus === "delivered" ? 1 : 0,
    lastAttemptNote: null,
  };
}

interface TimelineInput {
  readonly orderKey: string;
  readonly status: OnlineOrderStatus;
  readonly daysAgo: number;
  readonly buyerName: string;
  readonly courier: string | null;
  readonly sellerName: string;
}

export function buildDemoOrderTimeline({ orderKey, status, daysAgo, buyerName, courier, sellerName }: TimelineInput): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];
  const pushEvent = (kind: OrderTimelineEvent["kind"], summary: string, eventDaysAgo: number, hour: number, actorName: string | null) =>
    events.push({ id: `tl_${orderKey}_${events.length + 1}`, kind, summary, actorName, createdAt: buildIsoDateDaysAgo(Math.max(eventDaysAgo, 0), hour) });
  pushEvent("placed", `${buyerName} placed the order in the Zudomart app`, daysAgo, 9, buyerName);
  pushEvent("paid", "Payment confirmed and held in escrow", daysAgo, 9, null);
  if (status === "new") return events;
  if (status === "cancelled") {
    pushEvent("cancelled", "Order cancelled and buyer refunded from escrow", daysAgo - 1, 11, sellerName);
    return events;
  }
  pushEvent("accepted", "Order accepted", daysAgo, 11, sellerName);
  if (status === "processing") return events;
  pushEvent("ready", "Packed and ready for pickup", daysAgo - 1, 10, sellerName);
  if (status === "ready") return events;
  pushEvent("shipped", `Handed to ${courier ?? "the courier"}`, daysAgo - 1, 15, sellerName);
  if (status === "shipped") return events;
  pushEvent("delivered", "Delivered to the buyer", daysAgo - 3, 13, null);
  if (status === "delivered") return events;
  if (status === "completed") pushEvent("completed", "Buyer confirmed delivery — escrow released to your wallet", daysAgo - 4, 10, null);
  if (status === "disputed") pushEvent("disputed", "Buyer opened a dispute — escrow paused", daysAgo - 4, 10, buyerName);
  if (status === "returned") pushEvent("returned", "Item returned by the buyer and refunded", daysAgo - 6, 14, sellerName);
  if (status === "refunded") pushEvent("refunded", "Order refunded to the buyer", daysAgo - 5, 12, sellerName);
  return events;
}

export function buildDemoPaymentReference(_provider: "flutterwave", orderNumber: string, random: () => number): string {
  const randomPart = Math.floor(random() * 36 ** 8).toString(36).toUpperCase().padStart(8, "0");
  return `chk-${randomPart.toLowerCase()}${orderNumber.replace("ZM-", "")}`;
}
