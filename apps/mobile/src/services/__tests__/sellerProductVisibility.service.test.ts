const mockPost = jest.fn();

jest.mock("../core/apiClient.service", () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { sellerService } from "../sellers/seller.service";

describe("seller product visibility API", () => {
  beforeEach(() => mockPost.mockReset());

  it("publishes through the existing seller endpoint with an encoded product ID", async () => {
    const product = { id: "product/one", publishedOnline: true };
    mockPost.mockResolvedValue(product);

    await expect(sellerService.publishStoreProduct("product/one")).resolves.toBe(product);

    expect(mockPost).toHaveBeenCalledWith("/api/v1/seller/products/product%2Fone/publish", {});
  });

  it("hides through the existing seller endpoint with an encoded product ID", async () => {
    const product = { id: "product/one", publishedOnline: false };
    mockPost.mockResolvedValue(product);

    await expect(sellerService.unpublishStoreProduct("product/one")).resolves.toBe(product);

    expect(mockPost).toHaveBeenCalledWith("/api/v1/seller/products/product%2Fone/unpublish", {});
  });
});
