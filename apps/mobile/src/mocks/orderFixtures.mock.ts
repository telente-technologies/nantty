import type { DeliveryDetails, DeliveryStatus, Order, OrderStatus } from "@/types";
import type { ShipmentDetails } from "@/types/commerce.type";

import { SHIPPING_FEE_PER_STORE_IN_USD_CENTS } from "./commerceFixtures.mock";
import { isoDateHoursAgo } from "./fixtures.mock";
import type { CatalogProductKey } from "./mockImages.mock";
import { catalogProductSeeds, discountedUsdCents, productSummaryByKey } from "./productCatalog.mock";

export const SIGNED_IN_BUYER = "signed_in";
export const AUTO_RELEASE_HOURS_AFTER_DELIVERY = 72;
export const PLATFORM_FEE_PERCENT = 5;

export interface MockOrderLine {
  readonly productKey: CatalogProductKey;
  readonly quantity: number;
  readonly variant: string | null;
}

export interface MockOrderRecord {
  readonly id: string;
  readonly reference: string;
  readonly storeId: string;
  readonly buyerUserId: string;
  readonly lines: readonly MockOrderLine[];
  readonly checkoutGroupId: string | null;
  status: OrderStatus;
  placedAt: string;
  paidAt: string | null;
  shipment: ShipmentDetails | null;
  delivery: DeliveryDetails | null;
  deliveredAt: string | null;
  buyerConfirmedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  disputeId: string | null;
}

interface RecordTimeline {
  readonly placedHoursAgo: number;
  readonly shippedHoursAgo?: number;
  readonly courier?: readonly [courierName: string, trackingNumber: string];
  readonly rider?: readonly [riderName: string, riderPhone: string];
  readonly deliveryStatus?: DeliveryStatus;
  readonly attempts?: number;
  readonly lastAttemptNote?: string;
  readonly deliveredHoursAgo?: number;
  readonly confirmedHoursAgo?: number;
  readonly releasedHoursAgo?: number;
  readonly refundedHoursAgo?: number;
  readonly disputeId?: string;
}

const hoursAgoOrNull = (hours: number | undefined) => (hours === undefined ? null : isoDateHoursAgo(hours));

const deliveryStatusForOrderStatus = (status: OrderStatus): DeliveryStatus => {
  switch (status) {
    case "pending":
      return "pending";
    case "paid":
      return "preparing";
    case "shipped":
      return "in_transit";
    case "delivered":
    case "completed":
    case "disputed":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
};

export const buildShipment = (courierName: string, trackingNumber: string, shippedAt: string): ShipmentDetails => ({
  courierName,
  trackingNumber,
  trackingUrl: `https://track.nantty.com/${encodeURIComponent(trackingNumber)}`,
  shippedAt,
  estimatedDeliveryAt: new Date(new Date(shippedAt).getTime() + 3 * 86_400_000).toISOString(),
});

const defineRecord = (
  id: string,
  storeId: string,
  buyerUserId: string,
  status: OrderStatus,
  lines: readonly MockOrderLine[],
  timeline: RecordTimeline,
): MockOrderRecord => {
  const shipment =
    timeline.shippedHoursAgo !== undefined && timeline.courier
      ? buildShipment(timeline.courier[0], timeline.courier[1], isoDateHoursAgo(timeline.shippedHoursAgo))
      : null;
  const deliveryStatus = timeline.deliveryStatus ?? deliveryStatusForOrderStatus(status);
  return {
    id,
    reference: `ZM-${id.replace(/\D/g, "").padStart(5, "4")}`,
    storeId,
    buyerUserId,
    lines,
    checkoutGroupId: null,
    status,
    placedAt: isoDateHoursAgo(timeline.placedHoursAgo),
    paidAt: status === "pending" ? null : isoDateHoursAgo(timeline.placedHoursAgo - 0.1),
    shipment,
    delivery:
      deliveryStatus === "pending"
        ? null
        : {
            status: deliveryStatus,
            riderName: timeline.rider?.[0] ?? null,
            riderPhone: timeline.rider?.[1] ?? null,
            estimatedDeliveryAt: shipment?.estimatedDeliveryAt ?? null,
            attempts: timeline.attempts ?? 0,
            lastAttemptNote: timeline.lastAttemptNote ?? null,
          },
    deliveredAt: hoursAgoOrNull(timeline.deliveredHoursAgo),
    buyerConfirmedAt: hoursAgoOrNull(timeline.confirmedHoursAgo),
    releasedAt: hoursAgoOrNull(timeline.releasedHoursAgo),
    refundedAt: hoursAgoOrNull(timeline.refundedHoursAgo),
    disputeId: timeline.disputeId ?? null,
  };
};

const line = (productKey: CatalogProductKey, quantity: number, variant: string | null): MockOrderLine => ({ productKey, quantity, variant });
const GIG: readonly [string, string] = ["GIG Logistics", "GIG-7730941182"];

export const mockOrderRecords: MockOrderRecord[] = [
  defineRecord("o_4108", "s_ada", SIGNED_IN_BUYER, "pending", [line("f4", 1, "Gold")], { placedHoursAgo: 1 }),
  defineRecord("o_4107", "s_food", SIGNED_IN_BUYER, "paid", [line("fd1", 2, "5kg"), line("fd2", 3, "200g")], { placedHoursAgo: 5 }),
  defineRecord("o_4106", "s_glow", SIGNED_IN_BUYER, "shipped", [line("b3", 2, "30ml"), line("b1", 1, "250ml • Vanilla")], {
    placedHoursAgo: 40, shippedHoursAgo: 20, courier: GIG, rider: ["Tunde A.", "+234 803 555 0142"],
    deliveryStatus: "failed", attempts: 1, lastAttemptNote: "Customer did not answer the phone. Retrying tomorrow morning.",
  }),
  defineRecord("o_4105", "s_tunde", SIGNED_IN_BUYER, "delivered", [line("g6", 1, "Black")], {
    placedHoursAgo: 96, shippedHoursAgo: 80, courier: ["Kwik Delivery", "KWK-55812"], deliveredHoursAgo: 30,
  }),
  defineRecord("o_4104", "s_kicks", SIGNED_IN_BUYER, "disputed", [line("s2", 1, "UK 9 • White")], {
    placedHoursAgo: 190, shippedHoursAgo: 170, courier: ["DHL Nigeria", "DHL-1098823377"], deliveredHoursAgo: 120, disputeId: "d_901",
  }),
  defineRecord("o_4103", "s_ada", SIGNED_IN_BUYER, "completed", [line("f1", 1, "UK 10 • Blue & orange print")], {
    placedHoursAgo: 480, shippedHoursAgo: 460, courier: GIG, deliveredHoursAgo: 430, confirmedHoursAgo: 428, releasedHoursAgo: 428,
  }),
  defineRecord("o_4102", "s_kids", SIGNED_IN_BUYER, "cancelled", [line("k3", 1, "Blue dinosaur")], { placedHoursAgo: 600, refundedHoursAgo: 560 }),
  defineRecord("o_4101", "s_tunde", SIGNED_IN_BUYER, "completed", [line("g2", 1, "Black")], {
    placedHoursAgo: 900, shippedHoursAgo: 890, courier: GIG, deliveredHoursAgo: 860, releasedHoursAgo: 788,
  }),
  defineRecord("o_5208", "s_home", "u_10", "paid", [line("h2", 1, "3 litres")], { placedHoursAgo: 3 }),
  defineRecord("o_5207", "s_home", "u_7", "paid", [line("h3", 2, "Speckled cream")], { placedHoursAgo: 9 }),
  defineRecord("o_5206", "s_home", "u_8", "shipped", [line("h4", 3, "Lemongrass & ginger")], {
    placedHoursAgo: 50, shippedHoursAgo: 30, courier: ["GIG Logistics", "GIG-7730955210"], rider: ["Ibrahim B.", "+234 806 222 0199"],
  }),
  defineRecord("o_5205", "s_home", "u_11", "delivered", [line("h6", 1, null)], {
    placedHoursAgo: 120, shippedHoursAgo: 100, courier: ["Sendbox", "SBX-00417782"], deliveredHoursAgo: 22,
  }),
  defineRecord("o_5204", "s_home", "u_19", "disputed", [line("h4", 1, "Hibiscus")], {
    placedHoursAgo: 150, shippedHoursAgo: 130, courier: ["GIG Logistics", "GIG-7730912004"], deliveredHoursAgo: 60, disputeId: "d_902",
  }),
  defineRecord("o_5203", "s_home", "u_12", "completed", [line("h1", 2, "Natural")], {
    placedHoursAgo: 300, shippedHoursAgo: 280, courier: GIG, deliveredHoursAgo: 250, confirmedHoursAgo: 240, releasedHoursAgo: 240,
  }),
  defineRecord("o_5202", "s_home", "u_15", "completed", [line("h5", 2, "Indigo")], {
    placedHoursAgo: 420, shippedHoursAgo: 400, courier: GIG, deliveredHoursAgo: 370, releasedHoursAgo: 298,
  }),
  defineRecord("o_5201", "s_home", "u_17", "completed", [line("h7", 1, "Large"), line("h4", 2, "Vanilla & tobacco")], {
    placedHoursAgo: 700, shippedHoursAgo: 690, courier: GIG, deliveredHoursAgo: 650, confirmedHoursAgo: 640, releasedHoursAgo: 640,
  }),
];

export const usdCentsForOrderRecord = (record: MockOrderRecord) =>
  record.lines.reduce((sum, orderLine) => {
    const seed = catalogProductSeeds.find((candidate) => candidate.key === orderLine.productKey)!;
    return sum + discountedUsdCents(seed) * orderLine.quantity;
  }, SHIPPING_FEE_PER_STORE_IN_USD_CENTS);

export const sellerPayoutUsdCentsForOrderRecord = (record: MockOrderRecord) =>
  Math.round(usdCentsForOrderRecord(record) * (1 - PLATFORM_FEE_PERCENT / 100));

export const buildOrderItemsFromRecord = (record: MockOrderRecord): Order["items"] =>
  record.lines.map((orderLine, index) => ({
    id: `${record.id}_item_${index}`,
    product: productSummaryByKey(orderLine.productKey),
    quantity: orderLine.quantity,
    variant: orderLine.variant,
  }));

export const findOrderRecord = (orderId: string) => mockOrderRecords.find((record) => record.id === orderId);
