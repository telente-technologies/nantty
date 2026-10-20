import { ApiError } from "@/errors/api.error";
import type { OrderStatus } from "@/types";

import { isGroupPayable, mockCartState, storeIdForProduct, summariseMockCart } from "./commerceFixtures.mock";
import { buildEscrowDetailFromRecord, buildOrderFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { SIGNED_IN_BUYER, findOrderRecord, mockOrderRecords, type MockOrderRecord } from "./orderFixtures.mock";
import { findCatalogSeedByProductId, reduceCatalogStock } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findSignedInAddress } from "./settings.mock";

const paymentAttempts = new Map<string, number>();

const byNewestFirst = (a: MockOrderRecord, b: MockOrderRecord) => b.placedAt.localeCompare(a.placedAt);

const isSignedInUserPartyToOrder = (record: MockOrderRecord) =>
  record.buyerUserId === SIGNED_IN_BUYER || record.storeId === getSignedInMockUser().storeId;

export const findOrderRecordVisibleToSignedInUser = (orderId: string) => {
  const record = findOrderRecord(orderId);
  if (!record || !isSignedInUserPartyToOrder(record)) throw new ApiError(404, "Order not found");
  return record;
};

const createOrderRecordsFromCart = (payableStoreIds: readonly string[]): MockOrderRecord[] => {
  const checkoutGroupId = `chk_${Date.now()}`;
  return payableStoreIds.map((storeId, index) => {
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
  createMockRoute("POST", "/api/v1/orders/checkout", ({ body }) => {
    const { addressId } = body as { addressId?: string };
    const address = addressId ? findSignedInAddress(addressId) : undefined;
    if (!address) throw new ApiError(422, "Choose a delivery address");
    if (mockCartState.lines.length === 0) throw new ApiError(422, "Your cart is empty");
    const cart = summariseMockCart({ countryId: address.countryId, stateId: address.stateId, lgaId: address.lgaId, cityId: address.cityId }, address.id);
    const payableStoreIds = cart.groups.filter(isGroupPayable).map((group) => group.storeId);
    if (payableStoreIds.length === 0) throw new ApiError(422, "None of the sellers in your cart ship to this address");
    const records = createOrderRecordsFromCart(payableStoreIds);
    mockOrderRecords.unshift(...records);
    mockCartState.lines = mockCartState.lines.filter((line) => !payableStoreIds.includes(storeIdForProduct(line.productId)));
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
    const reference = `chk-${orderId}`;
    const checkoutUrl = `https://checkout.flutterwave.com/v3/hosted/pay/mock-${reference}`;
    return { orderId, reference, checkoutUrl, authorizationUrl: checkoutUrl, payment: { reference, provider: "flutterwave", status: "pending", checkoutUrl, authorizationUrl: checkoutUrl } };
  }),
  createMockRoute("POST", "/api/v1/payments/wallet-payments/:reference", ({ params }) => {
    const orderId = params.reference!.replace(/^chk-/, "");
    findOrderRecordVisibleToSignedInUser(orderId);
    markCheckoutGroupAsPaid(orderId);
    return { reference: params.reference, provider: "flutterwave", status: "succeeded", checkoutUrl: null, authorizationUrl: null, amount: { amountMinor: 0, currency: "NGN" } };
  }),
  createMockRoute("GET", "/api/v1/payments/channels", () => ({ channels: ["card", "bank_transfer", "ussd"] })),
  createMockRoute("POST", "/api/v1/payments/saved-cards/charges", ({ body }) => {
    const { paymentReference } = body as { paymentReference: string };
    const orderId = paymentReference.replace(/^chk-/, "");
    markCheckoutGroupAsPaid(orderId);
    return { status: "succeeded", checkoutUrl: null, authorizationUrl: null, paymentIntent: { reference: paymentReference, status: "succeeded" } };
  }),
  createMockRoute("POST", "/api/v1/payments/saved-cards/setups", () => ({
    reference: `card-setup-${Date.now()}`,
    checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/mock-card-setup",
    verificationCharge: { amountMinor: 5000, currency: "NGN" },
    expiresAt: null,
  })),
  createMockRoute("POST", "/api/v1/payments/saved-cards/setups/:reference/complete", () => ({
    savedCardId: "0190f3a2-7b1c-7cde-9f00-000000000001",
    brand: "Visa",
    last4: "4081",
    expiryMonth: 8,
    expiryYear: 2028,
  })),
  createMockRoute("POST", "/api/v1/payments/orders/:orderId/verify", ({ params }) => {
    const attempts = (paymentAttempts.get(params.orderId!) ?? 0) + 1;
    paymentAttempts.set(params.orderId!, attempts);
    if (attempts < 2) return { status: "pending" };
    markCheckoutGroupAsPaid(params.orderId!);
    return { status: "paid" };
  }),
];
