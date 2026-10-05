import { describe, expect, it } from "vitest";

import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { accountA, accountB, accountC, brandSource, categorySource, postSource, productSource, soundSource, storeSource, userSource } from "../fakes/sourceFixtures.fake.js";
import type { SearchReranker } from "../../src/interfaces/searchReranker.interface.js";

async function seed(harness: ReturnType<typeof createSearchHarness>) {
  const { hydrator, processor } = harness;
  hydrator.users.set(accountA, userSource());
  hydrator.users.set(accountC, userSource({ accountId: accountC, username: "sneaker_queen", displayName: "Queen of Sneakers" }));
  hydrator.stores.set("store_1", storeSource());
  hydrator.brands.set("brand_1", brandSource());
  hydrator.products.set("prod_1", productSource());
  hydrator.products.set("prod_2", productSource({ productId: "prod_2", name: "Blue sneakers", purchaseCount: 50 }));
  hydrator.posts.set("post_1", postSource());
  hydrator.posts.set("clip_1", postSource({ postId: "clip_1", kind: "clip", caption: "Sneakers unboxing #sneakers" }));
  hydrator.categories.set("cat_1", categorySource());
  hydrator.sounds.set("sound_1", soundSource());
  for (const accountId of [accountA, accountC]) await processor.process(envelope("profile.updated", { accountId, profileId: accountId, changedFields: [] }));
  await processor.process(envelope("store.created", { storeId: "store_1" }));
  await processor.process(envelope("brand.updated", { brandId: "brand_1" }));
  for (const productId of ["prod_1", "prod_2"]) await processor.process(envelope("product.published", { productId, storeId: "store_1" }));
  for (const postId of ["post_1", "clip_1"]) await processor.process(envelope("post.created", { postId }));
  await processor.process(envelope("category.updated", { categoryId: "cat_1" }));
  await processor.process(envelope("sound.updated", { soundId: "sound_1" }));
}

const ids = (page: { data: readonly Record<string, unknown>[] }) => page.data.map((item) => item["id"]);
const base = { viewerId: undefined, cursor: undefined, limit: 20, region: undefined } as const;

describe("search scopes", () => {
  it("returns typed items for top and filters by scope", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    const top = await harness.service.search({ ...base, query: "sneakers", type: "top" });
    expect(new Set(top.data.map((item) => item["type"]))).toEqual(new Set(["user", "store", "product", "post", "clip", "hashtag", "category"]));
    expect(ids(await harness.service.search({ ...base, query: "sneakers", type: "products" }))).toEqual(["prod_2", "prod_1"]);
    expect(ids(await harness.service.search({ ...base, query: "sneakers", type: "hashtags" }))).toEqual(["sneakers"]);
    expect(ids(await harness.service.search({ ...base, query: "lagos", type: "stores" }))).toEqual(["store_1"]);
    expect(ids(await harness.service.search({ ...base, query: "adire", type: "brands" }))).toEqual(["brand_1"]);
    expect(ids(await harness.service.search({ ...base, query: "lagos", type: "sounds" }))).toEqual(["sound_1"]);
    expect(ids(await harness.service.search({ ...base, query: "ada", type: "users" }))).toEqual([accountA]);
  });

  it("tolerates a typo and a leading marker", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    expect(ids(await harness.service.search({ ...base, query: "sneekers", type: "products" }))).toHaveLength(2);
    expect(ids(await harness.service.search({ ...base, query: "#sneakers", type: "hashtags" }))).toEqual(["sneakers"]);
    expect(ids(await harness.service.search({ ...base, query: "@ada_love", type: "users" }))).toEqual([accountA]);
  });

  it("returns nothing for a query without searchable tokens", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    expect((await harness.service.search({ ...base, query: "!!!", type: "top" })).data).toEqual([]);
  });

  it("serves the legacy grouped shape", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    const grouped = await harness.service.searchGrouped(undefined, "sneakers", undefined);
    expect(Object.keys(grouped).sort()).toEqual(["brands", "people", "products", "stores"]);
    expect(grouped.products).toHaveLength(2);
    expect(grouped.people).toHaveLength(1);
  });
});

describe("cursor pagination", () => {
  it("walks every result once with stable ordering", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    const seen: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = await harness.service.search({ ...base, query: "sneakers", type: "top", limit: 2, cursor });
      seen.push(...page.data.map((item) => `${String(item["type"])}:${String(item["id"])}`));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    const all = await harness.service.search({ ...base, query: "sneakers", type: "top" });
    expect(seen).toEqual(all.data.map((item) => `${String(item["type"])}:${String(item["id"])}`));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("treats a tampered cursor as the first page", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    const page = await harness.service.search({ ...base, query: "sneakers", type: "products", cursor: "garbage" });
    expect(page.data).toHaveLength(2);
  });
});

describe("privacy and availability", () => {
  it("hides suspended accounts together with their content", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    harness.hydrator.users.set(accountA, userSource({ status: "suspended" }));
    await harness.processor.process(envelope("account.suspended", { accountId: accountA }, "2026-10-03T11:00:00.000Z"));
    expect(ids(await harness.service.search({ ...base, query: "ada", type: "users" }))).toEqual([]);
    expect(ids(await harness.service.search({ ...base, query: "sneakers", type: "posts" }))).toEqual([]);
    expect((await harness.service.search({ ...base, query: "sneakers", type: "hashtags" })).data.length).toBe(1);
  });

  it("hides private profiles and their posts from strangers but not from followers or the owner", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    await harness.processor.process(envelope("profile.visibilityChanged", { accountId: accountA, profileId: accountA, isPrivate: true }));
    await harness.processor.process(envelope("follow.created", { followerId: accountB, followeeId: accountA }));
    const search = (viewerId: string | undefined, type: "users" | "posts") => harness.service.search({ ...base, viewerId, query: type === "users" ? "ada" : "sneakers", type });
    expect(ids(await search(undefined, "users"))).toEqual([]);
    expect(ids(await search(accountC, "posts"))).toEqual([]);
    expect(ids(await search(accountB, "users"))).toEqual([accountA]);
    expect(ids(await search(accountA, "users"))).toEqual([accountA]);
    expect(ids(await search(accountB, "posts"))).toContain("post_1");
  });

  it("shows follower-only posts to followers only", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    harness.hydrator.posts.set("post_1", postSource({ audience: "followers" }));
    await harness.processor.process(envelope("post.created", { postId: "post_1" }, "2026-10-03T11:00:00.000Z"));
    await harness.processor.process(envelope("follow.created", { followerId: accountB, followeeId: accountA }));
    expect(ids(await harness.service.search({ ...base, query: "lagos", type: "posts" }))).toEqual([]);
    expect(ids(await harness.service.search({ ...base, viewerId: accountB, query: "lagos", type: "posts" }))).toEqual(["post_1"]);
  });

  it("hides content in both directions of a block", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    await harness.processor.process(envelope("block.created", { blockerId: accountB, blockedId: accountA }));
    expect(ids(await harness.service.search({ ...base, viewerId: accountB, query: "ada", type: "users" }))).toEqual([]);
    expect(ids(await harness.service.search({ ...base, viewerId: accountA, query: "lagos", type: "stores" }))).toEqual([]);
    expect(ids(await harness.service.search({ ...base, viewerId: accountC, query: "ada", type: "users" }))).toEqual([accountA]);
  });

  it("drops out-of-stock products and suspended sellers' stores", async () => {
    const harness = createSearchHarness();
    await seed(harness);
    harness.hydrator.products.set("prod_2", productSource({ productId: "prod_2", stock: 0 }));
    await harness.processor.process(envelope("product.updated", { productId: "prod_2", storeId: "store_1", status: "published", visibility: "public" }, "2026-10-03T11:00:00.000Z"));
    expect(ids(await harness.service.search({ ...base, query: "sneakers", type: "products" }))).toEqual(["prod_1"]);
    harness.hydrator.users.set(accountB, userSource({ accountId: accountB, status: "banned" }));
    await harness.processor.process(envelope("account.banned", { accountId: accountB }, "2026-10-03T12:00:00.000Z"));
    expect(ids(await harness.service.search({ ...base, query: "lagos", type: "stores" }))).toEqual([]);
  });
});

describe("rerank", () => {
  const reverse: SearchReranker = { rerank: async (_viewer, candidates) => [...candidates].reverse().map((candidate) => candidate.itemId) };

  it("reorders the first page only with personalization consent", async () => {
    const harness = createSearchHarness(reverse);
    await seed(harness);
    const input = { ...base, viewerId: accountB, query: "sneakers", type: "products" as const };
    expect(ids(await harness.service.search(input))).toEqual(["prod_2", "prod_1"]);
    await harness.store.setConsent(accountB, "personalization", true);
    expect(ids(await harness.service.search(input))).toEqual(["prod_1", "prod_2"]);
    expect(ids(await harness.service.search({ ...input, viewerId: undefined }))).toEqual(["prod_2", "prod_1"]);
  });

  it("falls back to the deterministic order when the reranker times out", async () => {
    const harness = createSearchHarness({ rerank: async () => null });
    await seed(harness);
    await harness.store.setConsent(accountB, "personalization", true);
    expect(ids(await harness.service.search({ ...base, viewerId: accountB, query: "sneakers", type: "products" }))).toEqual(["prod_2", "prod_1"]);
  });
});
