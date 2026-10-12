import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appendAffiliateParameter, readSaleAttribution, rememberSaleAttribution } from "./saleAttribution.util";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
}

describe("sale attribution memory", () => {
  it("remembers the latest creator touch per product until it expires", () => {
    const storage = memoryStorage();
    rememberSaleAttribution("p1", { source: "post", id: "post_1" }, Date.now() + 1000, storage);
    rememberSaleAttribution("p1", { source: "link", id: "link_1" }, Date.now() + 1000, storage);
    assert.deepEqual(readSaleAttribution("p1", storage), { source: "link", id: "link_1" });
    assert.equal(readSaleAttribution("p2", storage), null);
    assert.equal(readSaleAttribution("p1", storage, Date.now() + 2000), null);
  });

  it("ignores unknown sources and corrupt storage", () => {
    const storage = memoryStorage();
    rememberSaleAttribution("p1", { source: "banner" as never, id: "x" }, Date.now() + 1000, storage);
    assert.equal(readSaleAttribution("p1", storage), null);
    storage.setItem("zudomart.saleAttributions", "{not json");
    assert.equal(readSaleAttribution("p1", storage), null);
  });

  it("keeps the affiliate parameter through canonical redirects only when it looks like an id", () => {
    assert.equal(appendAffiliateParameter("/p/dress-1", "0192-ab"), "/p/dress-1?aff=0192-ab");
    assert.equal(appendAffiliateParameter("/p/dress-1", "<script>"), "/p/dress-1");
    assert.equal(appendAffiliateParameter("/p/dress-1", undefined), "/p/dress-1");
  });
});
