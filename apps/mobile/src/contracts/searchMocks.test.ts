import { resolveMockApiRequest } from "@/mocks";
import { findCatalogSeedByProductId } from "@/mocks/productCatalog.mock";
import { searchMockCatalog } from "@/mocks/search.mock";
import type { RecentSearchEntry, SearchPage } from "@/types/search.type";
import { resolveSearchContext, searchPlaceholder, searchScopeChipLabel } from "@/utils/searchScope.util";

const productStoreId = (productId: string) => findCatalogSeedByProductId(productId)?.storeId;

describe("scoped search mocks", () => {
  it("keeps mart searches to marketplace products", () => {
    const items = searchMockCatalog("a", "mart");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.type === "product")).toBe(true);
  });

  it("keeps store searches to that store's products and posts", () => {
    const items = searchMockCatalog("a", "store:s_ada");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.type === "product") expect(productStoreId(item.id)).toBe("s_ada");
      else if (item.type === "post" || item.type === "clip") expect(item.authorId).toBe("u_1");
      else throw new Error(`unexpected ${item.type} in a store search`);
    }
  });

  it("lets a seller find their own store's orders, and nobody else's", () => {
    const own = searchMockCatalog("a", "store:s_home").filter((item) => item.type === "order");
    expect(own.length).toBeGreaterThan(0);
    expect(searchMockCatalog("a", "store:s_ada").some((item) => item.type === "order")).toBe(false);
  });

  it("never returns another user's posts in a profile search", () => {
    for (const item of searchMockCatalog("e", "profile:u_2")) {
      if (item.type === "post" || item.type === "clip") expect(item.authorId).toBe("u_2");
      else expect(item.type).toBe("product");
    }
  });

  it("pages results and stores recent searches per scope", async () => {
    const page = await resolveMockApiRequest<SearchPage>("GET", "/api/v1/search?q=a&scope=mart&type=products", undefined);
    expect(page.scope).toBe("mart");
    await resolveMockApiRequest("POST", "/api/v1/search/recent", { q: "sneakers", scope: "mart" });
    await resolveMockApiRequest("POST", "/api/v1/search/recent", { q: "ada", scope: "global" });
    const mart = await resolveMockApiRequest<{ data: RecentSearchEntry[] }>("GET", "/api/v1/search/recent?scope=mart", undefined);
    expect(mart.data.map((entry) => entry.query)).toEqual(["sneakers"]);
  });

  it("labels the scope chip and placeholder", () => {
    expect(searchPlaceholder(resolveSearchContext("mart", undefined))).toBe("Search Mart");
    expect(searchScopeChipLabel(resolveSearchContext("profile:u_1", "@ada"))).toBe("In: @ada");
    expect(searchScopeChipLabel(resolveSearchContext("all", undefined))).toBeNull();
  });
});
