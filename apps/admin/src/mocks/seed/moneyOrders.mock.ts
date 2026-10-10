import type { MockEscrowTimelineEvent, MockOrderItemRecord, MockOrderRecord } from "@/mocks/handlers/money/moneyRecords.mock";
import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";

type ProductKey = keyof typeof unsplashPhotoIds.products;
type OrderStage = "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "DISPUTED" | "REFUNDED" | "PARTIALLY_REFUNDED";

interface OrderSeedRow {
  readonly number: string;
  readonly buyer: number;
  readonly seller: number;
  readonly store: string;
  readonly currency: string;
  readonly items: readonly [string, ProductKey, number, number][];
  readonly delivery: number;
  readonly stage: OrderStage;
  readonly hoursAgo: number;
  readonly city: string;
  readonly disputeId?: string;
  readonly refundedMinor?: number;
}

const orderSeedRows: readonly OrderSeedRow[] = [
  { number: "ZM-24817", buyer: 2, seller: 1, store: "Adaeze Styles", currency: "NGN", items: [["Adire two-piece set, size M", "f1", 1, 45_000_00]], delivery: 3_500_00, stage: "DISPUTED", hoursAgo: 150, city: "Ibadan", disputeId: "dsp_0001" },
  { number: "ZM-24790", buyer: 6, seller: 13, store: "Funke Naturals", currency: "NGN", items: [["Whipped shea body butter 250ml", "b6", 3, 8_500_00]], delivery: 2_000_00, stage: "COMPLETED", hoursAgo: 260, city: "Kano" },
  { number: "ZM-24802", buyer: 11, seller: 5, store: "Emeka Gadgets", currency: "NGN", items: [["Wireless earbuds with charging case", "g6", 1, 38_000_00]], delivery: 2_500_00, stage: "DISPUTED", hoursAgo: 210, city: "Enugu", disputeId: "dsp_0002" },
  { number: "ZM-24811", buyer: 18, seller: 3, store: "Kemi's Kitchen", currency: "NGN", items: [["Chin chin, 1kg jar", "fd2", 2, 6_500_00]], delivery: 1_500_00, stage: "DELIVERED", hoursAgo: 52, city: "Lagos" },
  { number: "ZM-24820", buyer: 25, seller: 23, store: "Jide Kicks", currency: "NGN", items: [["Retro court sneakers, EU 43", "s2", 1, 62_000_00]], delivery: 3_000_00, stage: "SHIPPED", hoursAgo: 30, city: "Abuja" },
  { number: "ZM-24823", buyer: 15, seller: 19, store: "Halima Hijabs", currency: "NGN", items: [["Silk hijab bundle (3)", "f5", 2, 14_000_00]], delivery: 2_000_00, stage: "PAID", hoursAgo: 6, city: "Kaduna" },
  { number: "ZM-GH-1042", buyer: 7, seller: 17, store: "Nana Ama Shop", currency: "GHS", items: [["Handwoven kente stole", "f3", 1, 450_00]], delivery: 25_00, stage: "DISPUTED", hoursAgo: 96, city: "Kumasi", disputeId: "dsp_0003" },
  { number: "ZM-KE-0388", buyer: 27, seller: 8, store: "Wanjiru Home", currency: "KES", items: [["Soy wax candle, cedar", "h3", 2, 2_400_00]], delivery: 300_00, stage: "COMPLETED", hoursAgo: 320, city: "Nairobi" },
  { number: "ZM-24760", buyer: 22, seller: 1, store: "Adaeze Styles", currency: "GBP", items: [["Ankara wrap dress", "f2", 1, 85_00]], delivery: 12_00, stage: "DELIVERED", hoursAgo: 70, city: "London" },
  { number: "ZM-24744", buyer: 21, seller: 14, store: "Musa Motors", currency: "NGN", items: [["1080p dash camera", "g7", 1, 54_000_00]], delivery: 2_500_00, stage: "REFUNDED", hoursAgo: 400, city: "Port Harcourt", refundedMinor: 56_500_00 },
  { number: "ZM-24815", buyer: 28, seller: 24, store: "Ngozi Bakes", currency: "NGN", items: [["Red velvet celebration cake", "fd5", 1, 25_000_00]], delivery: 3_000_00, stage: "COMPLETED", hoursAgo: 120, city: "Lagos" },
  { number: "ZM-24799", buyer: 16, seller: 26, store: "Grace Decor", currency: "NGN", items: [["Mud-cloth throw pillow", "h4", 4, 9_000_00]], delivery: 2_500_00, stage: "DISPUTED", hoursAgo: 180, city: "Uyo", disputeId: "dsp_0004" },
  { number: "ZM-24826", buyer: 2, seller: 12, store: "Dayo Deals", currency: "NGN", items: [["Fitness smart watch", "g2", 1, 29_000_00]], delivery: 2_000_00, stage: "PAID", hoursAgo: 20, city: "Ibadan" },
  { number: "ZM-24731", buyer: 6, seller: 4, store: "Chioma Threads", currency: "NGN", items: [["Tailored lace gown", "f4", 1, 32_000_00]], delivery: 2_000_00, stage: "PARTIALLY_REFUNDED", hoursAgo: 500, city: "Kano", disputeId: "dsp_0005", refundedMinor: 12_000_00 },
  { number: "ZM-24808", buyer: 21, seller: 13, store: "Funke Naturals", currency: "NGN", items: [["Black soap bar", "b3", 5, 1_800_00], ["Hair growth oil", "b4", 1, 6_500_00]], delivery: 1_500_00, stage: "COMPLETED", hoursAgo: 200, city: "Port Harcourt" },
  { number: "ZM-24819", buyer: 11, seller: 23, store: "Jide Kicks", currency: "NGN", items: [["Canvas low-tops, EU 40", "s3", 1, 28_000_00]], delivery: 2_500_00, stage: "DELIVERED", hoursAgo: 40, city: "Enugu" },
];

const commissionBasisPointsByCurrency: Record<string, number> = { NGN: 150 };

export function readDemoUserIdForIndex(index: number): string {
  return `usr_${String(index).padStart(4, "0")}`;
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function buildTimelineForStage(row: OrderSeedRow, totalMinor: number, buyerName: string, sellerName: string): { timeline: MockEscrowTimelineEvent[]; autoReleaseAt: string | null } {
  const events: MockEscrowTimelineEvent[] = [];
  const add = (kind: MockEscrowTimelineEvent["kind"], hoursAfterPlacing: number, actorName: string, actorKind: MockEscrowTimelineEvent["actorKind"], note: string | null, amountMinor: number | null = null) =>
    events.push({ id: `${row.number}-${events.length + 1}`, kind, occurredAt: isoHoursAgo(row.hoursAgo - hoursAfterPlacing), actorName, actorKind, note, amount: amountMinor === null ? null : { amountMinor, currency: row.currency } });
  add("FUNDED", 0, buyerName, "BUYER", "Payment verified with the provider.", totalMinor);
  add("HELD", 0.02, "Escrow service", "SYSTEM", "Funds held until delivery is confirmed.", totalMinor);
  if (row.stage === "PAID") return { timeline: events, autoReleaseAt: null };
  add("SHIPPED", 20, sellerName, "SELLER", "Handed to courier.");
  if (row.stage === "SHIPPED") return { timeline: events, autoReleaseAt: null };
  add("DELIVERED", 46, "GIG Logistics", "SYSTEM", "Courier marked delivered.");
  const autoReleaseHours = 46 + 72;
  add("AUTO_RELEASE_SCHEDULED", 46.01, "Escrow service", "SYSTEM", "Releases to seller in 72 hours unless the buyer disputes.");
  if (row.stage === "DELIVERED") return { timeline: events, autoReleaseAt: isoHoursAgo(row.hoursAgo - autoReleaseHours) };
  if (row.stage === "COMPLETED") {
    add("RELEASED", autoReleaseHours, "Escrow service", "SYSTEM", "Auto-released to seller wallet.", totalMinor);
    return { timeline: events, autoReleaseAt: null };
  }
  if (row.stage === "REFUNDED") {
    add("REFUNDED", 60, "Chidi Okafor", "ADMIN", "Manual refund: courier lost the parcel.", row.refundedMinor ?? totalMinor);
    return { timeline: events, autoReleaseAt: null };
  }
  add("DISPUTED", 50, buyerName, "BUYER", "Buyer opened a dispute. Auto-release paused.");
  if (row.stage === "PARTIALLY_REFUNDED") add("PARTIALLY_REFUNDED", 90, "Chidi Okafor", "ADMIN", "Dispute resolved with a partial refund.", row.refundedMinor ?? 0);
  return { timeline: events, autoReleaseAt: null };
}

const orderStatusByStage = { PAID: "PAID", SHIPPED: "SHIPPED", DELIVERED: "DELIVERED", COMPLETED: "COMPLETED", DISPUTED: "DISPUTED", REFUNDED: "REFUNDED", PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED" } as const;
const escrowStatusByStage = { PAID: "HELD", SHIPPED: "HELD", DELIVERED: "HELD", COMPLETED: "RELEASED", DISPUTED: "DISPUTED", REFUNDED: "REFUNDED", PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED" } as const;
const deliveryStatusByStage = { PAID: "AWAITING_SHIPMENT", SHIPPED: "IN_TRANSIT", DELIVERED: "DELIVERED", COMPLETED: "DELIVERED", DISPUTED: "DELIVERED", REFUNDED: "RETURNED", PARTIALLY_REFUNDED: "DELIVERED" } as const;

export function calculateOrderTotalInMinorUnits(order: Pick<MockOrderRecord, "items" | "deliveryFeeMinor">): number {
  return order.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0) + order.deliveryFeeMinor;
}

export function buildDemoOrders(readDisplayName: (userId: string) => string): MockOrderRecord[] {
  return orderSeedRows.map((row, rowIndex) => {
    const items: MockOrderItemRecord[] = row.items.map(([productName, photoKey, quantity, unitPriceMinor], itemIndex) => ({
      id: `itm_${rowIndex + 1}_${itemIndex + 1}`,
      productName,
      imageUrl: buildUnsplashImageUrl(unsplashPhotoIds.products[photoKey][0], 240),
      quantity,
      unitPriceMinor,
    }));
    const totalMinor = calculateOrderTotalInMinorUnits({ items, deliveryFeeMinor: row.delivery });
    const buyerId = readDemoUserIdForIndex(row.buyer);
    const sellerId = readDemoUserIdForIndex(row.seller);
    const { timeline, autoReleaseAt } = buildTimelineForStage(row, totalMinor, readDisplayName(buyerId), readDisplayName(sellerId));
    return {
      id: `ord_${String(rowIndex + 1).padStart(4, "0")}`,
      orderNumber: row.number,
      buyerId,
      sellerId,
      storeName: row.store,
      currency: row.currency,
      items,
      deliveryFeeMinor: row.delivery,
      commissionBasisPoints: commissionBasisPointsByCurrency[row.currency] ?? 150,
      deliveryCity: row.city,
      courier: row.stage === "PAID" ? null : "GIG Logistics",
      trackingNumber: row.stage === "PAID" ? null : `GIG${(7_340_000 + rowIndex * 1_137).toString()}`,
      placedAt: isoHoursAgo(row.hoursAgo),
      status: orderStatusByStage[row.stage],
      deliveryStatus: deliveryStatusByStage[row.stage],
      escrowStatus: escrowStatusByStage[row.stage],
      autoReleaseAt,
      timeline,
      refundedMinor: row.refundedMinor ?? 0,
      disputeId: row.disputeId ?? null,
    };
  });
}
