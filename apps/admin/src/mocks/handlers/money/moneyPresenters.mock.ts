import { listMockAuditEntriesForTarget } from "@/mocks/mockAudit.mock";
import { findMockPlatformUser } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import type { DisputeDetail, DisputeSummary, OrderDetail, OrderSummary, RefundRecord } from "@/types/commerce.type";
import type { CoinTransaction, PayoutRequest } from "@/types/payouts.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

import type { MockCoinRecord, MockDisputeRecord, MockOrderRecord, MockPayoutRecord, MockRefundRecord } from "./moneyRecords.mock";
import { calculateCommissionInMinorUnits, calculateEscrowHeldMinor, calculateOrderTotalMinor, readMockMoneyStore } from "./moneyStore.mock";

export function presentUserById(userId: string): PlatformUserSummary {
  const user = findMockPlatformUser(userId);
  if (!user) failNotFound("User");
  return presentPlatformUserSummary(user);
}

const money = (amountMinor: number, currency: string) => ({ amountMinor, currency });

export function findMockOrderOrFail(orderId: string): MockOrderRecord {
  const order = readMockMoneyStore().orders.find((candidate) => candidate.id === orderId || candidate.orderNumber === orderId);
  if (!order) failNotFound("Order");
  return order;
}

export function presentOrderSummary(order: MockOrderRecord): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    buyer: presentUserById(order.buyerId),
    seller: presentUserById(order.sellerId),
    storeName: order.storeName,
    status: order.status,
    escrowStatus: order.escrowStatus,
    deliveryStatus: order.deliveryStatus,
    total: money(calculateOrderTotalMinor(order), order.currency),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    placedAt: order.placedAt,
    disputeId: order.disputeId,
  };
}

export function presentRefund(refund: MockRefundRecord): RefundRecord {
  const order = findMockOrderOrFail(refund.orderId);
  return { id: refund.id, orderId: order.id, orderNumber: order.orderNumber, buyer: presentUserById(order.buyerId), amount: money(refund.amountMinor, refund.currency), source: refund.source, status: refund.status, reason: refund.reason, createdAt: refund.createdAt, createdByName: refund.createdByName };
}

function presentEscrowState(order: MockOrderRecord) {
  return { status: order.escrowStatus, heldAmount: money(calculateEscrowHeldMinor(order), order.currency), autoReleaseAt: order.autoReleaseAt, timeline: [...order.timeline] };
}

export function calculateRefundableMinor(order: MockOrderRecord): number {
  if (order.escrowStatus === "RELEASED" || order.status === "CANCELLED") return 0;
  return Math.max(0, calculateEscrowHeldMinor(order));
}

export function presentOrderDetail(order: MockOrderRecord): OrderDetail {
  const subtotalMinor = order.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  return {
    ...presentOrderSummary(order),
    items: order.items.map((item) => ({ id: item.id, productName: item.productName, imageUrl: item.imageUrl, quantity: item.quantity, unitPrice: money(item.unitPriceMinor, order.currency), lineTotal: money(item.unitPriceMinor * item.quantity, order.currency) })),
    subtotal: money(subtotalMinor, order.currency),
    deliveryFee: money(order.deliveryFeeMinor, order.currency),
    commission: money(calculateCommissionInMinorUnits(calculateOrderTotalMinor(order) - order.refundedMinor, order.commissionBasisPoints), order.currency),
    commissionBasisPoints: order.commissionBasisPoints,
    refundedTotal: money(order.refundedMinor, order.currency),
    refundable: money(calculateRefundableMinor(order), order.currency),
    deliveryCity: order.deliveryCity,
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    escrow: presentEscrowState(order),
    refunds: readMockMoneyStore().refunds.filter((refund) => refund.orderId === order.id).map(presentRefund),
    history: listMockAuditEntriesForTarget("order", order.id),
  };
}

export function presentDisputeSummary(dispute: MockDisputeRecord): DisputeSummary {
  const order = findMockOrderOrFail(dispute.orderId);
  const escrowMinor = dispute.resolution ? calculateOrderTotalMinor(order) : calculateEscrowHeldMinor(order);
  return {
    id: dispute.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyer: presentUserById(order.buyerId),
    seller: presentUserById(order.sellerId),
    reasonCategory: dispute.reasonCategory,
    status: dispute.status,
    priority: dispute.priority,
    escrowAmount: money(escrowMinor, order.currency),
    openedAt: dispute.openedAt,
    slaDueAt: dispute.slaDueAt,
  };
}

export function presentDisputeDetail(dispute: MockDisputeRecord): DisputeDetail {
  const order = findMockOrderOrFail(dispute.orderId);
  const resolution = dispute.resolution;
  return {
    ...presentDisputeSummary(dispute),
    buyerClaim: dispute.buyerClaim,
    sellerResponse: dispute.sellerResponse,
    evidence: [...dispute.evidence],
    messages: [...dispute.messages],
    commissionBasisPoints: order.commissionBasisPoints,
    resolution: resolution
      ? { outcome: resolution.outcome, buyerRefund: money(resolution.buyerRefundMinor, order.currency), sellerPayout: money(resolution.sellerPayoutMinor, order.currency), commission: money(resolution.commissionMinor, order.currency), reason: resolution.reason, resolvedAt: resolution.resolvedAt, resolvedByName: resolution.resolvedByName }
      : null,
    escrow: presentEscrowState(order),
    history: listMockAuditEntriesForTarget("dispute", dispute.id),
  };
}

export function presentPayout(payout: MockPayoutRecord): PayoutRequest {
  return {
    id: payout.id,
    user: presentUserById(payout.userId),
    amount: money(payout.amountMinor, payout.currency),
    providerFee: money(payout.providerFeeMinor, payout.currency),
    netAmount: money(payout.amountMinor - payout.providerFeeMinor, payout.currency),
    provider: payout.provider,
    destination: payout.destination,
    source: payout.source,
    status: payout.status,
    requestedAt: payout.requestedAt,
    fraud: payout.fraud,
    walletBalanceAfter: money(payout.walletBalanceAfterMinor, payout.currency),
  };
}

export function presentCoinTransaction(coin: MockCoinRecord): CoinTransaction {
  const feeMinor = coin.feeBasisPoints === null ? null : Math.round((coin.fiatMinor * coin.feeBasisPoints) / 10_000);
  return {
    id: coin.id,
    kind: coin.kind,
    sender: presentUserById(coin.senderId),
    receiver: coin.receiverId ? presentUserById(coin.receiverId) : null,
    coins: coin.coins,
    fiatValue: money(coin.fiatMinor, coin.currency),
    platformFee: feeMinor === null ? null : money(feeMinor, coin.currency),
    platformFeeBasisPoints: coin.feeBasisPoints,
    context: coin.context,
    paymentProvider: coin.paymentProvider,
    status: coin.status,
    flags: [...coin.flags],
    chargebackRisk: coin.chargebackRisk,
    createdAt: coin.createdAt,
  };
}
