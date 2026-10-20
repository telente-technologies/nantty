import { ApiError } from "@/errors/api.error";
import type { OrderStatus } from "@/types";

import { mockCartState, storeIdForProduct, summariseMockCart } from "./commerceFixtures.mock";
import { buildEscrowDetailFromRecord, buildOrderFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { SIGNED_IN_BUYER, findOrderRecord, mockOrderRecords, type MockOrderRecord } from "./orderFixtures.mock";
import { findCatalogSeedByProductId, reduceCatalogStock } from "./productCatalog.mock";
import { mockProviderWalletState, payOrderFromMockWallet } from "./providerWallet.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const paymentAttempts = new Map<string, number>();

const byNewestFirst = (a: MockOrderRecord, b: MockOrderRecord) => b.placedAt.localeCompare(a.placedAt);

const isSignedInUserPartyToOrder = (record: MockOrderRecord) =>
  record.buyerUserId === SIGNED_IN_BUYER || record.storeId === getSignedInMockUser().storeId;

export const findOrderRecordVisibleToSignedInUser = (orderId: string) => {
  const record = findOrderRecord(orderId);
  if (!record || !isSignedInUserPartyToOrder(record)) throw new ApiError(404, "Order not found");
  return record;
};

const createOrderRecordsFromCart = (): MockOrderRecord[] => {
  const checkoutGroupId = `chk_${Date.now()}`;
  const storeIds = [...new Set(mockCartState.lines.map((cartLine) => storeIdForProduct(cartLine.productId)))];
  return storeIds.map((storeId, index) => {
    const now = new Date().toISOString();
    const orderNumber = String(Date.now() + index).slice(-5);
    return {
      id: `o_${orderNumber}`,
      reference: `ZM-${orderNumber}`,
      storeId,
      buyerUserId: SIGNED_IN_BUYER,
      checkoutGroupId,
      lines: mockCartState.lines
        .filter((cartLine) => storeIdForProduct(cartLine.productId) === storeId)
        .map((cartLine) => ({ productKey: findCatalogSeedByProductId(cartLine.productId)!.key, quantity: cartLine.quantity, variant: cartLine.variant })),
      status: "pending" as OrderStatus,
      placedAt: now,
      paidAt: null,
      shipment: null,
      delivery: null,
      deliveredAt: null,
      buyerConfirmedAt: null,
      releasedAt: null,
      refundedAt: null,
      disputeId: null,
    };
  });
};

const markCheckoutGroupAsPaid = (orderId: string) => {
  const record = findOrderRecord(orderId);
  if (!record) return;
  const paidAt = new Date().toISOString();
  mockOrderRecords
    .filter((candidate) => candidate.id === orderId || (record.checkoutGroupId && candidate.checkoutGroupId === record.checkoutGroupId))
    .forEach((candidate) => {
      candidate.status = "paid";
      candidate.paidAt = paidAt;
      candidate.delivery = { status: "preparing", riderName: null, riderPhone: null, estimatedDeliveryAt: null, attempts: 0, lastAttemptNote: null };
      candidate.lines.forEach((orderLine) => reduceCatalogStock(`pr_${orderLine.productKey}`, orderLine.quantity));
    });
};

export const ordersMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/orders/checkout", () => {
    if (mockCartState.lines.length === 0) throw new ApiError(422, "Your cart is empty");
    const cart = summariseMockCart();
    const records = createOrderRecordsFromCart();
    mockOrderRecords.unshift(...records);
    mockCartState.lines = [];
    return { orders: records.map(buildOrderFromRecord), payableOrderId: records[0]!.id, total: cart.total };
  }),
  createMockRoute("GET", "/api/v1/orders", ({ query }) => {
    const status = query.get("status");
    return mockOrderRecords
      .filter((record) => record.buyerUserId === SIGNED_IN_BUYER && (!status || record.status === status))
      .sort(byNewestFirst)
      .map(buildOrderFromRecord);
  }),
  createMockRoute("GET", "/api/v1/orders/:orderId", ({ params }) => buildOrderFromRecord(findOrderRecordVisibleToSignedInUser(params.orderId!))),
  createMockRoute("GET", "/api/v1/orders/:orderId/escrow", ({ params }) =>
    buildEscrowDetailFromRecord(findOrderRecordVisibleToSignedInUser(params.orderId!)),
  ),
  createMockRoute("POST", "/api/v1/orders/:orderId/confirm-receipt", ({ params }) => {
    const record = findOrderRecordVisibleToSignedInUser(params.orderId!);
    if (record.status === "completed") return buildOrderFromRecord(record);
    if (record.status !== "shipped" && record.status !== "delivered") throw new ApiError(409, "You can confirm once the seller has shipped");
    const now = new Date().toISOString();
    record.deliveredAt ??= now;
    record.buyerConfirmedAt = now;
    record.releasedAt = now;
    record.status = "completed";
    record.delivery = record.delivery
      ? { ...record.delivery, status: "delivered" }
      : { status: "delivered", riderName: null, riderPhone: null, estimatedDeliveryAt: null, attempts: 0, lastAttemptNote: null };
    return buildOrderFromRecord(record);
  }),
  createMockRoute("POST", "/api/v1/payments/initialize", ({ body }) => {
    const { orderId } = body as { orderId: string };
    const record = findOrderRecordVisibleToSignedInUser(orderId);
    const reference = `chk-${orderId}`;
    const checkoutUrl = `/pay/demo?reference=${encodeURIComponent(reference)}`;
    const amount = buildOrderFromRecord(record).total;
    const payment = { reference, provider: "flutterwave", status: "pending", amount, checkoutUrl, authorizationUrl: checkoutUrl };
    return { orderId, checkoutId: record.checkoutGroupId ?? orderId, reference, checkoutUrl, authorizationUrl: checkoutUrl, callbackUrl: "/pay/return", paymentsInCheckout: 1, payment };
  }),
  createMockRoute("POST", "/api/v1/payments/wallet-payments/:reference", ({ params }) => {
    const reference = params.reference!;
    const record = findOrderRecordVisibleToSignedInUser(reference.replace(/^chk-/, ""));
    payOrderFromMockWallet(reference, buildOrderFromRecord(record).total.amountMinor);
    markCheckoutGroupAsPaid(record.id);
    return { reference, status: "paid", provider: "flutterwave" };
  }),
  createMockRoute("GET", "/api/v1/payments/channels", () => ({ channels: ["card", "bank_transfer", "ussd"] })),
  createMockRoute("POST", "/api/v1/payments/orders/:orderId/verify", ({ params }) => ({ status: advanceMockOrderPayment(params.orderId!) })),
  createMockRoute("GET", "/api/v1/payments/:reference", ({ params }) => {
    const reference = params.reference!;
    const outcome = advanceMockOrderPayment(reference.replace(/^chk-/, ""));
    return { reference, purpose: "order_checkout", provider: "flutterwave", status: outcome === "paid" ? "succeeded" : outcome };
  }),
];

function advanceMockOrderPayment(orderId: string): "pending" | "paid" | "failed" {
  if (mockProviderWalletState.declinedReferences.has(`chk-${orderId}`)) return "failed";
  if (findOrderRecord(orderId)?.paidAt) return "paid";
  const attempts = (paymentAttempts.get(orderId) ?? 0) + 1;
  paymentAttempts.set(orderId, attempts);
  if (attempts < 2) return "pending";
  markCheckoutGroupAsPaid(orderId);
  return "paid";
}
