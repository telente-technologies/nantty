import { api } from "@/services/core/apiClient.service";
import { productsService } from "@/services/sellers/products.service";

jest.mock("@/services/core/apiClient.service", () => ({ api: { get: jest.fn() } }));

test("requests personalized Mart recommendations through the Go public API contract", async () => {
  const response = { products: [], source: "popular" as const };
  jest.mocked(api.get).mockResolvedValueOnce(response);

  await expect(productsService.fetchProductsYouMightLike()).resolves.toEqual(response);
  expect(api.get).toHaveBeenCalledWith("/api/v1/mart/recommendations/for-you", { surface: "for_you" });
});

it("requests Mart-home rankings for the Mart recommendation ranking pipeline", async () => {
  const response = { products: [], source: "popular" as const };
  jest.mocked(api.get).mockResolvedValue(response as never);

  await expect(productsService.fetchProductsYouMightLike("mart_home")).resolves.toEqual(response);
  expect(api.get).toHaveBeenCalledWith("/api/v1/mart/recommendations/for-you", { surface: "mart_home" });
});

it("requests Clips-specific personalized recommendations", async () => {
  const response = { products: [], source: "personalized" as const };
  jest.mocked(api.get).mockResolvedValue(response as never);

  await expect(productsService.fetchProductsYouMightLike("clips")).resolves.toEqual(response);
  expect(api.get).toHaveBeenCalledWith("/api/v1/mart/recommendations/for-you", { surface: "clips" });
});
