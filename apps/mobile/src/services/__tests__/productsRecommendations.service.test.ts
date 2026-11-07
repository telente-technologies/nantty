import { api } from "@/services/core/apiClient.service";
import { productsService } from "@/services/sellers/products.service";

jest.mock("@/services/core/apiClient.service", () => ({ api: { get: jest.fn() } }));

test("requests personalized Mart recommendations through the Go public API contract", async () => {
  const response = { products: [], source: "popular" as const };
  jest.mocked(api.get).mockResolvedValueOnce(response);

  await expect(productsService.fetchProductsYouMightLike()).resolves.toEqual(response);
  expect(api.get).toHaveBeenCalledWith("/api/v1/mart/recommendations/for-you");
});
