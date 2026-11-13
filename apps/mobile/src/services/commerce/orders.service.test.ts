const mockGet = jest.fn();
const mockGetList = jest.fn();
const mockPost = jest.fn();
const mockGetPage = jest.fn();

jest.mock("../core/apiClient.service", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), getList: (...args: unknown[]) => mockGetList(...args), getPage: (...args: unknown[]) => mockGetPage(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import { ordersService } from "./orders.service";

describe("ordersService pagination", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
    mockPost.mockReset();
    mockGetPage.mockReset();
  });

  it("requests the first buyer-orders page without a cursor", async () => {
    const page = { data: [], nextCursor: "cursor-2" };
    mockGet.mockResolvedValue(page);

    await expect(ordersService.fetchMyOrdersPage(null, null)).resolves.toBe(page);
    expect(mockGet).toHaveBeenCalledWith("/api/v1/orders", { status: undefined, cursor: undefined });
  });

  it("preserves the status filter and opaque cursor for later pages", async () => {
    mockGet.mockResolvedValue({ data: [], nextCursor: null });

    await ordersService.fetchMyOrdersPage("completed", "opaque-cursor+/=");

    expect(mockGet).toHaveBeenCalledWith("/api/v1/orders", { status: "completed", cursor: "opaque-cursor+/=" });
  });

  it("keeps the first-page list helper available for existing consumers", async () => {
    const orders = [{ id: "order-1" }];
    mockGetList.mockResolvedValue(orders);

    await expect(ordersService.fetchMyOrders(null)).resolves.toBe(orders);
    expect(mockGetList).toHaveBeenCalledWith("/api/v1/orders", { status: undefined });
  });

  it("cancels an order through the authenticated buyer order route", async () => {
    const cancelled = { id: "order/1", status: "cancelled" };
    mockPost.mockResolvedValue(cancelled);

    await expect(ordersService.cancelOrder("order/1")).resolves.toBe(cancelled);
    expect(mockPost).toHaveBeenCalledWith("/api/v1/orders/order%2F1/cancel", { reason: "Cancelled by buyer" });
  });

  it("loads the buyer's cursor-paginated return requests", async () => {
    const page = { data: [{ id: "return-1" }], nextCursor: "next" };
    mockGetPage.mockResolvedValue(page);

    await expect(ordersService.fetchMyReturnsPage(null)).resolves.toBe(page);
    expect(mockGetPage).toHaveBeenCalledWith("/api/v1/returns", { cursor: undefined, limit: 100, orderId: undefined });
  });

  it("filters buyer return requests to the order being viewed", async () => {
    mockGetPage.mockResolvedValue({ data: [], nextCursor: null });

    await ordersService.fetchMyReturnsPage(null, 100, "order-1");

    expect(mockGetPage).toHaveBeenCalledWith("/api/v1/returns", { cursor: undefined, limit: 100, orderId: "order-1" });
  });

  it("submits the reviewed shipping quote revision with checkout", async () => {
    const checkout = { payableOrderId: "order-1" };
    mockPost.mockResolvedValue(checkout);

    await expect(ordersService.checkoutCartIntoOrders("address-1", "a".repeat(64), "checkout-key", { "store-1": "escrow" })).resolves.toBe(checkout);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/orders/checkout",
      { addressId: "address-1", shippingQuoteRevision: "a".repeat(64), paymentModes: [{ storeId: "store-1", paymentMode: "escrow" }], directPaymentAccepted: false },
      { idempotencyKey: "checkout-key" },
    );
  });

  it("submits the requested lines and reason to the order return route", async () => {
    const created = { id: "return-1", orderId: "order/1", status: "requested" };
    const input = { lines: [{ orderItemId: "line-1", quantity: 2 }], reason: "Item arrived damaged" };
    mockPost.mockResolvedValue(created);

    await expect(ordersService.requestReturn("order/1", input)).resolves.toBe(created);
    expect(mockPost).toHaveBeenCalledWith("/api/v1/orders/order%2F1/returns", input);
  });
});
