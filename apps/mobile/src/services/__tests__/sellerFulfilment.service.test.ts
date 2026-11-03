const mockGet = jest.fn();
const mockGetList = jest.fn();
const mockPost = jest.fn();

jest.mock("../core/apiClient.service", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { sellerService } from "../sellers/seller.service";

describe("seller shipment fulfilment", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
    mockPost.mockReset();
    mockGetList.mockResolvedValue([{ id: "location-1", active: true, isDefault: true }]);
    mockPost.mockResolvedValue({});
    mockGet.mockResolvedValue({ id: "order-1" });
  });

  it("forwards the optional tracking URL with the selected fulfilment origin", async () => {
    await sellerService.markStoreOrderAsShipped(
      "order-1",
      { courierName: "GIG Logistics", trackingNumber: "GIG-1234", trackingUrl: " https://carrier.example/track/GIG-1234 " },
      "ship-key",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/seller/orders/order-1/fulfilment",
      { courier: "GIG Logistics", trackingNumber: "GIG-1234", trackingUrl: "https://carrier.example/track/GIG-1234", fromLocationId: "location-1" },
      { idempotencyKey: "ship-key" },
    );
  });

  it("sends null when no tracking URL is provided", async () => {
    await sellerService.markStoreOrderAsShipped(
      "order-1",
      { courierName: "GIG Logistics", trackingNumber: "GIG-1234" },
      "ship-key",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/seller/orders/order-1/fulfilment",
      { courier: "GIG Logistics", trackingNumber: "GIG-1234", trackingUrl: null, fromLocationId: "location-1" },
      { idempotencyKey: "ship-key" },
    );
  });
});
