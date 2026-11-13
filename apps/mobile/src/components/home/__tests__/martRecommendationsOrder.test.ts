import { prioritizeMartRecommendations } from "@/utils/martRecommendations.util";
import type { ProductSummary } from "@/types";

const product = (id: string): ProductSummary => ({
  id,
  name: id,
  price: { amountMinor: 1000, currency: "NGN" },
  imageUrl: null,
  hasVariants: false,
});

test("Mart places personalized recommendations before catalog fallback and deduplicates", () => {
  const ranked = prioritizeMartRecommendations(
    [product("catalog-a"), product("shared"), product("catalog-b")],
    [product("ranked-a"), product("shared")],
  );

  expect(ranked.map(({ id }) => id)).toEqual(["ranked-a", "shared", "catalog-a", "catalog-b"]);
});
