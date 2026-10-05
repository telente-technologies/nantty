import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { findCatalogSeedByProductId } from "@/mocks/productCatalog.mock";
import { searchMockCatalog } from "@/mocks/search.mock";
import type { RecentSearchEntry, SearchPage } from "@/types/search.type";
import { resolveSearchContext, searchPlaceholder, searchScopeChipLabel } from "@/utils/searchScope.util";

const productStoreId = (productId: string) => findCatalogSeedByProductId(productId)?.storeId;

describe("scoped search mocks", () => {
  it("keeps mart searches to marketplace products", () => {
    const items = searchMockCatalog("a", "mart");
    assert.ok(items.length > 0);
    assert.equal(items.every((item) => item.type === "product"), true);
  });

  it("keeps store searches to that store's products and posts", () => {
    const items = searchMockCatalog("a", "store:s_ada");
    assert.ok(items.length > 0);
    for (const item of items) {
      if (item.type === "product") assert.equal(productStoreId(item.id), "s_ada");
      else if (item.type === "post" || item.type === "clip") assert.equal(item.authorId, "u_1");
      else throw new Error(`unexpected ${item.type} in a store search`);
    }
  });

  it("never returns another user's posts in a profile search", () => {
    for (const item of searchMockCatalog("e", "profile:u_2")) {
      if (item.type === "post" || item.type === "clip") assert.equal(item.authorId, "u_2");
      else assert.equal(item.type, "product");
    }
  });

  it("pages results and stores recent searches per scope", async () => {
    const page = (await dispatchMockApiRequest("GET", "/api/v1/search", new URLSearchParams("q=a&scope=mart&type=products"), null)) as SearchPage;
    assert.equal(page.scope, "mart");
    const body = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    await dispatchMockApiRequest("POST", "/api/v1/search/recent", new URLSearchParams(), body({ q: "sneakers", scope: "mart" }));
    await dispatchMockApiRequest("POST", "/api/v1/search/recent", new URLSearchParams(), body({ q: "ada", scope: "global" }));
    const mart = (await dispatchMockApiRequest("GET", "/api/v1/search/recent", new URLSearchParams("scope=mart"), null)) as { data: RecentSearchEntry[] };
    assert.deepEqual(mart.data.map((entry) => entry.query), ["sneakers"]);
  });

  it("labels the scope chip and placeholder", () => {
    assert.equal(searchPlaceholder(resolveSearchContext("mart", undefined)), "Search Mart");
    assert.equal(searchScopeChipLabel(resolveSearchContext("profile:u_1", "@ada")), "In: @ada");
    assert.equal(searchScopeChipLabel(resolveSearchContext("all", undefined)), null);
  });
});
