import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/errors/api.error";

import { productsMocks } from "./products.mock";

const recommendationRoute = productsMocks.find((route) =>
  route.method === "GET" && route.path === "/api/v1/mart/recommendations/for-you",
);

describe("product recommendation mocks", () => {
  it("returns a verified-store-first popular fallback on every supported surface", () => {
    assert.ok(recommendationRoute);
    for (const surface of ["for_you", "mart_home", "clips"]) {
      const response = recommendationRoute.handler({ params: {}, query: new URLSearchParams({ surface }), body: null }) as {
        readonly products: readonly { readonly storeVerified?: boolean }[];
        readonly source: string;
      };
      assert.equal(response.source, "popular");
      assert.ok(response.products.length > 0);
      const firstUnverified = response.products.findIndex((product) => product.storeVerified !== true);
      if (firstUnverified >= 0) {
        assert.ok(response.products.slice(0, firstUnverified).every((product) => product.storeVerified === true));
        assert.ok(response.products.slice(firstUnverified).every((product) => product.storeVerified !== true));
      }
    }
  });

  it("rejects unknown recommendation surfaces like the API contract", () => {
    assert.ok(recommendationRoute);
    assert.throws(
      () => recommendationRoute.handler({ params: {}, query: new URLSearchParams({ surface: "unknown" }), body: null }),
      (error: unknown) => error instanceof ApiError && error.code === "VALIDATION_FAILED",
    );
  });
});
