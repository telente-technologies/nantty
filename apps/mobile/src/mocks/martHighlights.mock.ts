import type { Page } from "@/types";
import type { MartHighlight } from "@/types/martHighlight.type";

import { martImageUrl } from "./mockImages.mock";
import { buildCatalogProductSummary, catalogProductSeeds, isMartSponsoredSeed, listMartProductSummaries } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { productCategories } from "./storeDirectory.mock";

type Candidate = Omit<MartHighlight, "ranking"> & { readonly baseScore: number; readonly reason: MartHighlight["ranking"]["reason"] };

const DEFAULT_LIMIT = 6;
let rankingRound = 0;

const fixedCandidates: Candidate[] = [
  {
    id: "hl_deals", kind: "deals_of_the_day", title: "Deals of the Day", subtitle: "Up to 40% off, today only",
    imageUrl: martImageUrl("salesOfTheDay", 1200), target: { type: "collection", collection: "sales_of_the_day", name: "Sales of the Day" },
    baseScore: 0.82, reason: { code: "time_sensitive", label: "Ends tonight" },
  },
  {
    id: "hl_brands", kind: "featured_brands", title: "Featured Brands", subtitle: "Official and verified stores",
    imageUrl: martImageUrl("featuredBrands", 1200), target: { type: "collection", collection: "featured_brands", name: "Featured Brands" },
    baseScore: 0.74, reason: { code: "followed_brands", label: "From brands you follow" },
  },
  {
    id: "hl_arrivals", kind: "new_arrivals", title: "New Arrivals", subtitle: "Just listed by sellers",
    imageUrl: martImageUrl("newArrivals", 1200), target: { type: "collection", collection: "new_arrivals", name: "New Arrivals" },
    baseScore: 0.7, reason: { code: "fresh_listings", label: "Fresh this week" },
  },
  {
    id: "hl_trending", kind: "trending", title: "Trending near you", subtitle: "What shoppers around you are buying",
    imageUrl: martImageUrl("heroBanner", 1200), target: { type: "collection", collection: "sales_of_the_day", name: "Sales of the Day" },
    baseScore: 0.66, reason: { code: "trending_nearby", label: "Popular in your area" },
  },
];

const categoryCandidates = (): Candidate[] =>
  productCategories.slice(0, 4).map((category, index) => ({
    id: `hl_${category.id}`,
    kind: "category_spotlight",
    title: category.name,
    subtitle: "Picked for you",
    imageUrl: listMartProductSummaries(category.id)[0]?.imageUrl ?? martImageUrl("heroBannerAlt", 1200),
    target: { type: "category", categoryId: category.id, name: category.name },
    baseScore: 0.6 - index * 0.04,
    reason: { code: "browsing_history", label: `Because you browsed ${category.name}` },
  }));

const boostedProductCandidates = (round: number): MartHighlight[] =>
  catalogProductSeeds.filter(isMartSponsoredSeed).map((seed) => {
    const product = buildCatalogProductSummary(seed, { sponsored: true });
    return {
      id: `hl_boost_${product.id}`,
      kind: "boosted_product",
      title: product.name,
      subtitle: product.sponsored?.advertiserName ?? null,
      imageUrl: product.imageUrl,
      target: { type: "product", productId: product.id, name: product.name },
      ranking: { score: Math.round((0.8 + jitter(product.id, round) * 0.2) * 1000) / 1000, reason: { code: "sponsored", label: "Sponsored" } },
      sponsored: product.sponsored,
    };
  });

const jitter = (id: string, round: number) => {
  let hash = round * 7919;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 100_003;
  return (hash % 1000) / 1000;
};

export function rankMartHighlights(round: number, limit = DEFAULT_LIMIT): MartHighlight[] {
  const editorial = [...fixedCandidates, ...categoryCandidates()].map(({ baseScore, reason, ...highlight }): MartHighlight => ({
    ...highlight,
    ranking: { score: Math.round((baseScore * 0.6 + jitter(highlight.id, round) * 0.4) * 0.8 * 1000) / 1000, reason },
  }));
  return [...boostedProductCandidates(round), ...editorial]
    .sort((left, right) => right.ranking.score - left.ranking.score)
    .slice(0, limit);
}

export const martHighlightsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/mart/highlights", ({ query }): Page<MartHighlight> => {
    rankingRound += 1;
    const limit = Math.min(Number(query.get("limit")) || DEFAULT_LIMIT, 10);
    return { data: rankMartHighlights(rankingRound, limit), nextCursor: null };
  }),
];
