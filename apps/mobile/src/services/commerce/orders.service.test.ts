const mockGet = jest.fn();
const mockGetList = jest.fn();

jest.mock("../core/apiClient.service", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), getList: (...args: unknown[]) => mockGetList(...args) },
}));

import { ordersService } from "./orders.service";

describe("ordersService pagination", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
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
});
