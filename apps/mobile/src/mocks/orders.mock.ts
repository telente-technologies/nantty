import type { Order, OrderStatus } from "@/types";

import { mockCartState, mockOrdersState, summariseMockCart } from "./commerceFixtures.mock";
import { buildMockUserSummary } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const addresses = [
  { id: "a_1", fullName: "Enyo Dev", phone: "+234 907 750 5722", line1: "12 Admiralty Way, Lekki Phase 1", city: "Lekki", state: "Lagos", isDefault: true },
];

const paymentAttempts = new Map<string, number>();

const updateMockOrderStatus = (orderId: string, status: OrderStatus): Order | undefined => {
  mockOrdersState.orders = mockOrdersState.orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  return mockOrdersState.orders.find((o) => o.id === orderId);
};

export const ordersMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/addresses", () => addresses),
  createMockRoute("POST", "/api/v1/orders/checkout", () => {
    const cart = summariseMockCart();
    const order: Order = {
      id: `o_${Date.now()}`,
      reference: `ZM-${String(Date.now()).slice(-4)}`,
      status: "pending",
      items: cart.items,
      total: cart.total,
      buyer: buildMockUserSummary(2, "Enyo Dev"),
      store: mockOrdersState.orders[0]!.store,
      createdAt: new Date().toISOString(),
      escrowReleaseAt: null,
    };
    mockOrdersState.orders = [order, ...mockOrdersState.orders];
    mockCartState.items = [];
    return { orders: [order], payableOrderId: order.id, total: order.total };
  }),
  createMockRoute("GET", "/api/v1/orders", ({ query }) => {
    const status = query.get("status");
    return status ? mockOrdersState.orders.filter((o) => o.status === status) : mockOrdersState.orders;
  }),
  createMockRoute("GET", "/api/v1/orders/:orderId", ({ params }) => mockOrdersState.orders.find((o) => o.id === params.orderId)),
  createMockRoute("POST", "/api/v1/orders/:orderId/confirm-receipt", ({ params }) => updateMockOrderStatus(params.orderId!, "completed")),
  createMockRoute("POST", "/api/v1/orders/:orderId/disputes", ({ params }) => updateMockOrderStatus(params.orderId!, "disputed")),
  createMockRoute("POST", "/api/v1/payments/initialize", ({ body }) => {
    const { orderId } = body as { orderId: string };
    return { orderId, reference: `PSK_${orderId}`, authorizationUrl: "https://checkout.paystack.com/mock" };
  }),
  createMockRoute("POST", "/api/v1/payments/orders/:orderId/verify", ({ params }) => {
    const attempts = (paymentAttempts.get(params.orderId!) ?? 0) + 1;
    paymentAttempts.set(params.orderId!, attempts);
    if (attempts < 2) return { status: "pending" };
    updateMockOrderStatus(params.orderId!, "paid");
    return { status: "paid" };
  }),
];
