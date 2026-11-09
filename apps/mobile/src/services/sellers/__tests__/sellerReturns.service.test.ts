const mockGetPage = jest.fn();
const mockPost = jest.fn();

jest.mock("../../core/apiClient.service", () => ({
  api: {
    getPage: (...args: unknown[]) => mockGetPage(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { sellerReturnsService } from "../sellerReturns.service";

describe("seller return request API contract", () => {
  beforeEach(() => {
    mockGetPage.mockReset();
    mockPost.mockReset();
    mockGetPage.mockResolvedValue({ data: [], nextCursor: null });
    mockPost.mockResolvedValue({ id: "return-1", status: "approved" });
  });

  it("requests the first paginated seller-return page without a cursor or status filter", async () => {
    await sellerReturnsService.listStoreReturns({ cursor: null, status: null });

    expect(mockGetPage).toHaveBeenCalledWith("/api/v1/seller/returns", {
      cursor: undefined,
      status: undefined,
      limit: 25,
    });
  });

  it("preserves opaque cursors and sends the selected backend status", async () => {
    await sellerReturnsService.listStoreReturns({ cursor: "cursor+/=opaque", status: "approved", limit: 50 });

    expect(mockGetPage).toHaveBeenCalledWith("/api/v1/seller/returns", {
      cursor: "cursor+/=opaque",
      status: "approved",
      limit: 50,
    });
  });

  it("approves only through the mounted seller action path", async () => {
    await sellerReturnsService.approveStoreReturn("return/a");

    expect(mockPost).toHaveBeenCalledWith("/api/v1/seller/returns/return%2Fa/approve", {});
  });

  it("sends the required decline note unchanged to the mounted endpoint", async () => {
    await sellerReturnsService.declineStoreReturn("return-1", { note: "Item arrived damaged" });

    expect(mockPost).toHaveBeenCalledWith("/api/v1/seller/returns/return-1/decline", { note: "Item arrived damaged" });
  });

  it.each([
    [{ restock: false, locationId: null }],
    [{ restock: true, locationId: "location-1" }],
  ] as const)("sends restock choice and location to the receive endpoint", async (input) => {
    await sellerReturnsService.receiveStoreReturn("return-1", input);

    expect(mockPost).toHaveBeenCalledWith("/api/v1/seller/returns/return-1/receive", input);
  });
});
