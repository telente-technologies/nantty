import { describe, expect, it } from "vitest";

import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { productSource } from "../fakes/sourceFixtures.fake.js";
import { buildProductDocument } from "../../src/modules/indexing/services/entityDocumentBuilders.service.js";

const base = { cursor: undefined, limit: 20, scope: "products" } as const;

describe("shipping-region visibility in search", () => {
  it("indexes the seller's shipping regions on the product document", () => {
    expect(buildProductDocument(productSource({ shippingRegions: ["NG", "GH"] }), 1).shippingRegions).toEqual(["NG", "GH"]);
    expect(buildProductDocument(productSource(), 1).shippingRegions).toEqual([]);
  });

  it("hides products from viewers whose region the seller does not ship to, but not from the seller", async () => {
    const harness = createSearchHarness();
    harness.hydrator.products.set("prod_ng", productSource({ productId: "prod_ng", name: "Sneakers local", shippingRegions: ["NG"] }));
    harness.hydrator.products.set("prod_gh", productSource({ productId: "prod_gh", name: "Sneakers abroad", shippingRegions: ["NG", "GH"] }));
    for (const productId of ["prod_ng", "prod_gh"]) await harness.processor.process(envelope("product.created", { productId }));
    const ids = async (region: string | undefined, viewerId?: string) => (await harness.service.search({ ...base, viewerId, region, query: "sneakers" })).data.map((item) => item["id"]).sort();
    expect(await ids("GH")).toEqual(["prod_gh"]);
    expect(await ids("NG")).toEqual(["prod_gh", "prod_ng"]);
    expect(await ids(undefined)).toEqual(["prod_gh", "prod_ng"]);
    expect(await ids("KE", productSource().ownerAccountId)).toEqual(["prod_gh", "prod_ng"]);
  });
});
