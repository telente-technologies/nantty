import { findMockPlatformUser } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import type { PartySummary } from "@/types/api.type";
import type { ChargebackRisk, CoinTransaction } from "@/types/coins.type";
import type { DisputeDetail, DisputeStatus, DisputeSummary, OrderDetail, OrderParty, OrderStatus, OrderSummary, RefundRecord } from "@/types/commerce.type";
import type { StaffWithdrawal } from "@/types/withdrawals.type";

import type { MockCoinRecord, MockDisputeRecord, MockOrderRecord, MockRefundRecord, MockWithdrawalRecord } from "./moneyRecords.mock";
import { calculateCommissionInMinorUnits, calculateEscrowHeldMinor, calculateOrderTotalMinor, readMockMoneyStore } from "./moneyStore.mock";

const money = (amountMinor: number, currency: string) => ({ amountMinor, currency });

export function presentOrderParty(userId: string): OrderParty {
  const user = findMockPlatformUser(userId);
  return { id: userId, username: user?.username ?? "", displayName: user?.displayName ?? "", avatarUrl: user?.avatarUrl ?? null };
}

export function presentParty(userId: string): PartySummary {
  const user = findMockPlatformUser(userId);
  return { id: userId, name: user?.displayName ?? null, username: user?.username ?? null };
}

export function findMockOrderOrFail(orderId: string): MockOrderRecord {
  const order = readMockMoneyStore().orders.find((candidate) => candidate.id === orderId || candidate.orderNumber === orderId);
  if (!order) failNotFound("Order");
  return order;
}

const orderStatusByMockStatus: Record<MockOrderRecord["status"], OrderStatus> = { PAID: "new", SHIPPED: "shipped", DELIVERED: "delivered", COMPLETED: "completed", CANCELLED: "cancelled", REFUNDED: "refunded", PARTIALLY_REFUNDED: "completed", DISPUTED: "disputed" };
const escrowStatusByMockStatus: Record<MockOrderRecord["escrowStatus"], string> = { FUNDED: "held", HELD: "held", RELEASED: "released", REFUNDED: "refunded", PARTIALLY_REFUNDED: "partially_refunded", DISPUTED: "disputed" };

function readPaymentStatus(order: MockOrderRecord): string {
  if (order.escrowStatus === "REFUNDED") return "refunded";
  return order.refundedMinor > 0 ? "partially_refunded" : "paid";
}

export function presentOrderSummary(order: MockOrderRecord): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber: `INV-${order.orderNumber}`,
    buyer: presentOrderParty(order.buyerId),
    seller: presentOrderParty(order.sellerId),
    storeId: `store_${order.sellerId}`,
    storeName: order.storeName,
    status: orderStatusByMockStatus[order.status],
    paymentStatus: readPaymentStatus(order),
    paymentMode: "escrow",
    escrowStatus: escrowStatusByMockStatus[order.escrowStatus],
    deliveryStatus: order.deliveryStatus.toLowerCase(),
    total: money(calculateOrderTotalMinor(order), order.currency),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    placedAt: order.placedAt,
  };
}

export function presentRefund(refund: MockRefundRecord): RefundRecord {
  const order = findMockOrderOrFail(refund.orderId);
  return {
    id: refund.id, orderId: order.id, orderNumber: order.orderNumber, storeId: `store_${order.sellerId}`, buyer: presentOrderParty(order.buyerId), amount: money(refund.amountMinor, refund.currency),
    source: refund.source === "DISPUTE" ? "dispute" : "manual", status: refund.status === "COMPLETED" ? "completed" : refund.status === "FAILED" ? "failed" : "processing",
    reason: refund.reason, createdAt: refund.createdAt, completedAt: refund.status === "COMPLETED" ? refund.createdAt : null, createdByName: refund.createdByName,
  };
}

export function calculateRefundableMinor(order: MockOrderRecord): number {
  if (order.status === "CANCELLED" || order.escrowStatus === "REFUNDED") return 0;
  return Math.max(0, calculateOrderTotalMinor(order) - order.refundedMinor);
}

export function presentOrderDetail(order: MockOrderRecord): OrderDetail {
  const subtotalMinor = order.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  const heldMinor = calculateEscrowHeldMinor(order);
  const commissionMinor = calculateCommissionInMinorUnits(calculateOrderTotalMinor(order) - order.refundedMinor, order.commissionBasisPoints);
  return {
    ...presentOrderSummary(order),
    items: order.items.map((item) => ({ id: item.id, productId: `prd_${item.id}`, productName: item.productName, variant: "", imageUrl: item.imageUrl, quantity: item.quantity, unitPrice: money(item.unitPriceMinor, order.currency), lineTotal: money(item.unitPriceMinor * item.quantity, order.currency), attribution: null })),
    subtotal: money(subtotalMinor, order.currency),
    discount: money(0, order.currency),
    storeCredit: money(0, order.currency),
    deliveryFee: money(order.deliveryFeeMinor, order.currency),
    refundedTotal: money(order.refundedMinor, order.currency),
    refundable: money(calculateRefundableMinor(order), order.currency),
    deliveryCity: order.deliveryCity,
    deliveryState: "",
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    escrow: {
      status: escrowStatusByMockStatus[order.escrowStatus], heldAmount: money(heldMinor, order.currency), commission: money(commissionMinor, order.currency),
      sellerAmount: money(Math.max(calculateOrderTotalMinor(order) - order.refundedMinor - commissionMinor, 0), order.currency), refunded: money(order.refundedMinor, order.currency),
      autoReleaseAt: order.autoReleaseAt, releasedAt: null, refundedAt: null,
    },
    refunds: readMockMoneyStore().refunds.filter((refund) => refund.orderId === order.id).map(presentRefund),
    timeline: order.timeline.map((event) => ({ id: event.id, kind: event.kind.toLowerCase(), summary: event.note ?? "", actorKind: event.actorKind.toLowerCase(), actorName: event.actorName, occurredAt: event.occurredAt })),
  };
}

export function presentDisputeStatus(dispute: MockDisputeRecord): DisputeStatus {
  if (dispute.status === "AWAITING_SELLER") return "awaiting_seller";
  if (dispute.status !== "RESOLVED") return "under_review";
  return dispute.resolution?.outcome === "RELEASE_TO_SELLER" ? "resolved_released" : "resolved_refunded";
}

export function presentDisputeSummary(dispute: MockDisputeRecord): DisputeSummary {
  const order = findMockOrderOrFail(dispute.orderId);
  const status = presentDisputeStatus(dispute);
  const isOpen = status === "awaiting_seller" || status === "under_review";
  return {
    id: dispute.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    productName: order.items[0]?.productName ?? "",
    buyer: presentParty(order.buyerId),
    seller: presentParty(order.sellerId),
    store: { id: `store_${order.sellerId}`, name: order.storeName },
    reason: dispute.reasonCategory.toLowerCase(),
    status,
    priority: dispute.priority === "URGENT" ? "urgent" : dispute.priority === "HIGH" ? "high" : "normal",
    escrowAmount: money(calculateOrderTotalMinor(order), order.currency),
    openedAt: dispute.openedAt,
    slaDueAt: dispute.slaDueAt,
    isSlaBreached: isOpen && dispute.slaDueAt < new Date().toISOString(),
  };
}

const resolutionOutcomes = { REFUND_FULL: "refund", REFUND_PARTIAL: "partial", RELEASE_TO_SELLER: "release" } as const;

export function presentDisputeDetail(dispute: MockDisputeRecord): DisputeDetail {
  const order = findMockOrderOrFail(dispute.orderId);
  const resolution = dispute.resolution;
  const totalMinor = calculateOrderTotalMinor(order);
  const summary = presentDisputeSummary(dispute);
  const history = [{ status: "awaiting_seller", label: "Dispute opened", occurredAt: dispute.openedAt }];
  if (resolution) history.push({ status: summary.status, label: "Resolved by support", occurredAt: resolution.resolvedAt });
  return {
    ...summary,
    description: dispute.buyerClaim,
    evidenceUrls: dispute.evidence.filter((evidence) => evidence.submittedBy === "BUYER").map((evidence) => evidence.imageUrl),
    sellerResponse: dispute.sellerResponse,
    commissionBasisPoints: order.commissionBasisPoints,
    escrow: {
      escrowId: `esc_${order.id}`, status: escrowStatusByMockStatus[order.escrowStatus], amount: money(totalMinor, order.currency), heldAmount: money(calculateEscrowHeldMinor(order), order.currency),
      refundedAmount: money(order.refundedMinor, order.currency), releasedAmount: money(resolution?.sellerPayoutMinor ?? 0, order.currency),
      commission: money(calculateCommissionInMinorUnits(totalMinor, order.commissionBasisPoints), order.currency), processingFee: money(0, order.currency), paymentReference: `PSK-${order.orderNumber}`, deliveredAt: null,
    },
    resolution: resolution
      ? { outcome: resolutionOutcomes[resolution.outcome], buyerRefund: money(resolution.buyerRefundMinor, order.currency), sellerPayout: money(resolution.sellerPayoutMinor, order.currency), commission: money(resolution.commissionMinor, order.currency), note: resolution.reason, resolvedAt: resolution.resolvedAt, resolvedByStaffId: resolution.resolvedByName }
      : null,
    messages: dispute.messages.map((message) => ({ id: message.id, authorRole: message.authorRole === "ADMIN" ? "support" : message.authorRole === "SELLER" ? "seller" : "buyer", authorName: message.authorName, authorAvatarUrl: null, text: message.body, attachmentUrls: [], createdAt: message.sentAt })),
    history,
  };
}

export function presentWithdrawal(withdrawal: MockWithdrawalRecord): StaffWithdrawal {
  const amount = money(withdrawal.amountMinor, withdrawal.currency);
  return {
    id: withdrawal.id, kind: "withdrawal", amount, description: "Withdrawal to bank", createdAt: withdrawal.createdAt, status: withdrawal.withdrawalStatus === "paid" ? "completed" : withdrawal.withdrawalStatus === "failed" || withdrawal.withdrawalStatus === "cancelled" ? "failed" : "pending",
    reference: withdrawal.reference, fee: money(withdrawal.feeMinor, withdrawal.currency), netAmount: money(withdrawal.amountMinor - withdrawal.feeMinor, withdrawal.currency),
    withdrawalStatus: withdrawal.withdrawalStatus, payoutAccountId: withdrawal.destination.payoutAccountId, failureReason: withdrawal.failureReason, processedAt: withdrawal.processedAt,
    userId: withdrawal.userId, user: presentParty(withdrawal.userId), provider: withdrawal.provider, destination: withdrawal.destination,
    reviewedByStaffId: withdrawal.reviewedByStaffId, reviewedAt: withdrawal.reviewedAt, reviewNote: withdrawal.reviewNote,
  };
}

const velocityRules = new Set(["coin_purchase_velocity", "transfer_burst", "transfer_fan_out"]);

function readChargebackRisk(coin: MockCoinRecord): ChargebackRisk {
  if (coin.flags.length > 0 || coin.reviewFlags.some((rule) => !velocityRules.has(rule))) return "high";
  return coin.reviewFlags.length > 0 ? "medium" : "low";
}

export function presentCoinTransaction(coin: MockCoinRecord): CoinTransaction {
  return {
    id: coin.id, kind: coin.kind, reference: coin.reference, sender: presentParty(coin.senderId), receiver: coin.receiverId ? presentParty(coin.receiverId) : null,
    coins: coin.coins, feeCoins: coin.feeCoins, platformFeeBasisPoints: coin.feeBasisPoints, fiatValue: coin.fiatMinor === null ? null : money(coin.fiatMinor, coin.currency),
    paymentProvider: coin.paymentProvider, channel: coin.channel, transactionStatus: coin.transactionStatus, reviewStatus: coin.reviewStatus,
    reviewFlags: [...coin.reviewFlags], flags: [...coin.flags], chargebackRisk: readChargebackRisk(coin), clawbackShortfallCoins: coin.clawbackShortfallCoins,
    createdAt: coin.createdAt, reviewedAt: coin.reviewedAt, reviewedByStaffId: coin.reviewedByStaffId, reviewNote: coin.reviewNote,
  };
}
