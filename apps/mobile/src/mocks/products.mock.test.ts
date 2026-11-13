import { productsMocks } from "./products.mock";
import { guestAccessMocks } from "./guestAccess.mock";

const recommendationRoute = productsMocks.find((route) =>
  route.method === "GET" && route.path === "/api/v1/mart/recommendations/for-you",
);

describe("product recommendation mocks", () => {
  it("serves a verified-store-first popular fallback for supported surfaces", () => {
    expect(recommendationRoute).toBeDefined();
    for (const surface of ["for_you", "mart_home", "clips"]) {
      const response = recommendationRoute!.handler({ params: {}, query: new URLSearchParams({ surface }), body: null }) as {
        readonly products: readonly { readonly storeVerified?: boolean }[];
        readonly source: string;
      };
      expect(response.source).toBe("popular");
      expect(response.products.length).toBeGreaterThan(0);
      const firstUnverified = response.products.findIndex((product) => product.storeVerified !== true);
      if (firstUnverified >= 0) {
        expect(response.products.slice(0, firstUnverified).every((product) => product.storeVerified === true)).toBe(true);
        expect(response.products.slice(firstUnverified).every((product) => product.storeVerified !== true)).toBe(true);
      }
    }
  });

  it("rejects unknown ranking surfaces and keeps the endpoint readable by guests", () => {
    expect(() => recommendationRoute!.handler({ params: {}, query: new URLSearchParams({ surface: "unknown" }), body: null })).toThrow("Unsupported product recommendation surface");
    expect(guestAccessMocks.isAllowedWithoutSession("GET", "/api/v1/mart/recommendations/for-you", {})).toBe(true);
  });
});
