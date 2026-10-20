import type { Order, UserSummary } from "@/types";
import type { EscrowDetail, EscrowHold, EscrowStage } from "@/types/commerce.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import {
  AUTO_RELEASE_HOURS_AFTER_DELIVERY,
  SIGNED_IN_BUYER,
  buildOrderItemsFromRecord,
  sellerPayoutUsdCentsForOrderRecord,
  usdCentsForOrderRecord,
  type MockOrderRecord,
} from "./orderFixtures.mock";
import { findDirectoryStoreById, summariseStore } from "./storeDirectory.mock";
import { findDirectoryUserById, summariseUser } from "./userDirectory.mock";

const HOUR_IN_MS = 3_600_000;
const SELLER_PREPARATION_ALLOWANCE_HOURS = 72;

const addHours = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * HOUR_IN_MS).toISOString();

const buyerSummaryForRecord = (record: MockOrderRecord): UserSummary =>
  record.buyerUserId === SIGNED_IN_BUYER ? summariseUser(getSignedInMockUser()) : summariseUser(findDirectoryUserById(record.buyerUserId)!);

export const escrowStageForRecord = (record: MockOrderRecord): EscrowStage => {
  switch (record.status) {
    case "pending":
      return "awaiting_payment";
    case "paid":
      return "seller_preparing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "completed":
      return "released_to_seller";
    case "disputed":
      return "disputed";
    default:
      return "refunded";
  }
};

export const autoReleaseAtForRecord = (record: MockOrderRecord) =>
  record.deliveredAt ? addHours(record.deliveredAt, AUTO_RELEASE_HOURS_AFTER_DELIVERY) : null;

export const expectedReleaseAtForRecord = (record: MockOrderRecord): string | null => {
  if (record.status === "completed") return record.releasedAt;
  if (record.status === "cancelled" || record.status === "pending" || record.status === "disputed") return null;
  if (record.deliveredAt) return autoReleaseAtForRecord(record);
  if (record.shipment?.estimatedDeliveryAt) return addHours(record.shipment.estimatedDeliveryAt, AUTO_RELEASE_HOURS_AFTER_DELIVERY);
  return record.paidAt ? addHours(record.paidAt, SELLER_PREPARATION_ALLOWANCE_HOURS + 72 + AUTO_RELEASE_HOURS_AFTER_DELIVERY) : null;
};

export function buildOrderFromRecord(record: MockOrderRecord): Order {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    items: buildOrderItemsFromRecord(record),
    total: convertUsdCentsToViewerCurrency(usdCentsForOrderRecord(record)),
    buyer: buyerSummaryForRecord(record),
    store: summariseStore(findDirectoryStoreById(record.storeId)),
    createdAt: record.placedAt,
    escrowReleaseAt: expectedReleaseAtForRecord(record),
    shipment: record.shipment,
    delivery: record.delivery,
  };
}

export function buildEscrowDetailFromRecord(record: MockOrderRecord): EscrowDetail {
  const totalUsdCents = usdCentsForOrderRecord(record);
  const payoutUsdCents = sellerPayoutUsdCentsForOrderRecord(record);
  const store = findDirectoryStoreById(record.storeId);
  return {
    orderId: record.id,
    orderReference: record.reference,
    stage: escrowStageForRecord(record),
    heldAmount: convertUsdCentsToViewerCurrency(totalUsdCents),
    platformFee: convertUsdCentsToViewerCurrency(totalUsdCents - payoutUsdCents),
    sellerPayoutAmount: convertUsdCentsToViewerCurrency(payoutUsdCents),
    buyer: buyerSummaryForRecord(record),
    store: summariseStore(store),
    sellerUserId: store.ownerUserKey,
    paidAt: record.paidAt,
    preparingSince: record.paidAt,
    shipment: record.shipment,
    deliveredAt: record.deliveredAt,
    buyerConfirmedAt: record.buyerConfirmedAt,
    autoReleaseAt: autoReleaseAtForRecord(record),
    expectedReleaseAt: expectedReleaseAtForRecord(record),
    releasedAt: record.releasedAt,
    refundedAt: record.refundedAt,
    disputeId: record.disputeId,
  };
}

export const buildEscrowHoldFromRecord = (record: MockOrderRecord): EscrowHold => ({
  orderId: record.id,
  orderReference: record.reference,
  productName: buildOrderItemsFromRecord(record)[0]?.product.name ?? record.reference,
  amount: convertUsdCentsToViewerCurrency(sellerPayoutUsdCentsForOrderRecord(record)),
  stage: escrowStageForRecord(record),
  expectedReleaseAt: expectedReleaseAtForRecord(record),
});
