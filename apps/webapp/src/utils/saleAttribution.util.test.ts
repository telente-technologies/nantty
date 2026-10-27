import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appendAffiliateParameter, readOrCreateVisitorId, readSaleAttribution, rememberSaleAttribution } from "./saleAttribution.util";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
}

describe("sale attribution memory", () => {
  it("keeps the first creator touch per product until it expires, and the same creator refreshes it", () => {
    const storage = memoryStorage();
    rememberSaleAttribution("p1", { source: "post", id: "post_1" }, Date.now() + 1000, storage);
    rememberSaleAttribution("p1", { source: "link", id: "link_1" }, Date.now() + 1000, storage);
    assert.deepEqual(readSaleAttribution("p1", storage), { source: "post", id: "post_1" });
    rememberSaleAttribution("p1", { source: "post", id: "post_1" }, Date.now() + 5000, storage);
    assert.deepEqual(readSaleAttribution("p1", storage, Date.now() + 3000), { source: "post", id: "post_1" });
    assert.equal(readSaleAttribution("p2", storage), null);
    assert.equal(readSaleAttribution("p1", storage, Date.now() + 6000), null);
  });

  it("keeps one random visitor id per browser for click counting", () => {
    const storage = memoryStorage();
    const first = readOrCreateVisitorId(storage);
    assert.match(first ?? "", /^[0-9a-f-]{36}$/);
    assert.equal(readOrCreateVisitorId(storage), first);
  });

  it("ignores unknown sources and corrupt storage", () => {
    const storage = memoryStorage();
    rememberSaleAttribution("p1", { source: "banner" as never, id: "x" }, Date.now() + 1000, storage);
    assert.equal(readSaleAttribution("p1", storage), null);
    storage.setItem("nantty.saleAttributions", "{not json");
    assert.equal(readSaleAttribution("p1", storage), null);
  });

  it("keeps the affiliate parameter through canonical redirects only when it looks like an id", () => {
    assert.equal(appendAffiliateParameter("/p/dress-1", "0192-ab"), "/p/dress-1?aff=0192-ab");
    assert.equal(appendAffiliateParameter("/p/dress-1", "<script>"), "/p/dress-1");
    assert.equal(appendAffiliateParameter("/p/dress-1", undefined), "/p/dress-1");
  });
});
