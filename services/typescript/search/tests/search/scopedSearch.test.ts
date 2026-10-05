import { describe, expect, it } from "vitest";

import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { accountA, accountB, accountC, categorySource, postSource, productSource, storeSource, userSource } from "../fakes/sourceFixtures.fake.js";
import type { SearchScope } from "../../src/enums/searchScope.enum.js";
import { formatSearchScope, parseSearchScope, resolveScopeAndType } from "../../src/utils/searchScope.util.js";

const storeS = "44444444-4444-4444-8444-444444444444";
const storeT = "55555555-5555-4555-8555-555555555555";
const later = "2026-10-03T11:00:00.000Z";

async function seed() {
  const harness = createSearchHarness();
  const { hydrator, processor } = harness;
  hydrator.users.set(accountA, userSource());
  hydrator.users.set(accountC, userSource({ accountId: accountC, username: "sneaker_queen", displayName: "Queen of Sneakers" }));
  hydrator.stores.set(storeS, storeSource({ storeId: storeS, name: "Lagos Sneakers" }));
  hydrator.stores.set(storeT, storeSource({ storeId: storeT, ownerAccountId: accountC, name: "Queen Sneakers Store" }));
  hydrator.products.set("prod_s", productSource({ productId: "prod_s", storeId: storeS }));
  hydrator.products.set("prod_t", productSource({ productId: "prod_t", storeId: storeT, ownerAccountId: accountC, name: "Queen sneakers" }));
  hydrator.posts.set("post_a", postSource({ postId: "post_a" }));
  hydrator.posts.set("clip_a", postSource({ postId: "clip_a", kind: "clip", caption: "Sneakers unboxing #sneakers" }));
  hydrator.posts.set("post_b", postSource({ postId: "post_b", authorId: accountB, caption: "Sneakers restock at the store" }));
  hydrator.posts.set("post_c", postSource({ postId: "post_c", authorId: accountC, caption: "My sneakers collection" }));
  hydrator.categories.set("cat_1", categorySource());
  for (const accountId of [accountA, accountC]) await processor.process(envelope("profile.updated", { accountId, profileId: accountId, changedFields: [] }));
  for (const storeId of [storeS, storeT]) await processor.process(envelope("store.created", { storeId }));
  for (const [productId, storeId] of [["prod_s", storeS], ["prod_t", storeT]]) await processor.process(envelope("product.published", { productId, storeId }));
  for (const postId of ["post_a", "clip_a", "post_b", "post_c"]) await processor.process(envelope("post.created", { postId }));
  await processor.process(envelope("category.updated", { categoryId: "cat_1" }));
  return harness;
}

type Harness = Awaited<ReturnType<typeof seed>>;
const search = async (harness: Harness, scope: SearchScope, options: { viewerId?: string; type?: "top" | "users" | "posts" | "products"; region?: string; viewerIsAdult?: boolean } = {}) =>
  (await harness.service.search({ viewerId: options.viewerId, query: "sneakers", scope, type: options.type ?? "top", cursor: undefined, limit: 50, region: options.region, viewerIsAdult: options.viewerIsAdult }));
const ids = async (...args: Parameters<typeof search>) => (await search(...args)).data.map((item) => String(item["id"])).sort();
const profile = (accountId: string): SearchScope => ({ kind: "profile", accountId });

describe("scope parsing", () => {
  it("accepts global, mart, store and profile scopes with uuid ids only", () => {
    expect(parseSearchScope(undefined)).toEqual({ kind: "global" });
    expect(parseSearchScope("mart")).toEqual({ kind: "mart" });
    expect(parseSearchScope(`store:${storeS.toUpperCase()}`)).toEqual({ kind: "store", storeId: storeS });
    expect(parseSearchScope(`profile:${accountA}`)).toEqual({ kind: "profile", accountId: accountA });
    for (const raw of ["store:store_1", "profile:", "profile", "people:" + accountA, `profile:${accountA};drop`, "MART"]) expect(parseSearchScope(raw)).toBeNull();
    expect(formatSearchScope({ kind: "store", storeId: storeS })).toBe(`store:${storeS}`);
  });

  it("keeps the legacy tab values of scope working and never groups a scoped search", () => {
    expect(resolveScopeAndType("products", undefined)).toEqual({ scope: { kind: "global" }, type: "products" });
    expect(resolveScopeAndType("all", undefined)).toEqual({ scope: { kind: "global" }, type: "all" });
    expect(resolveScopeAndType("mart", "all")).toEqual({ scope: { kind: "mart" }, type: "top" });
    expect(resolveScopeAndType("nope", undefined)).toBeNull();
  });
});

describe("mart scope", () => {
  it("returns only marketplace products and categories", async () => {
    const harness = await seed();
    const page = await search(harness, { kind: "mart" });
    expect(new Set(page.data.map((item) => item["type"]))).toEqual(new Set(["product", "category"]));
    expect(page.scope).toBe("mart");
    expect(await ids(harness, { kind: "mart" }, { type: "users" })).toEqual([]);
    expect(await ids(harness, { kind: "mart" }, { type: "posts" })).toEqual([]);
  });

  it("hides products the seller cannot ship to the viewer's region", async () => {
    const harness = await seed();
    harness.hydrator.products.set("prod_t", productSource({ productId: "prod_t", storeId: storeT, ownerAccountId: accountC, name: "Queen sneakers", shippingRegions: ["GH"] }));
    await harness.processor.process(envelope("product.updated", { productId: "prod_t", storeId: storeT }, later));
    expect(await ids(harness, { kind: "mart" }, { type: "products", region: "NG" })).toEqual(["prod_s"]);
    expect(await ids(harness, { kind: "mart" }, { type: "products", region: "GH" })).toEqual(["prod_s", "prod_t"]);
  });
});

describe("store scope", () => {
  it("returns only that store's products and its owner's posts", async () => {
    const harness = await seed();
    expect(await ids(harness, { kind: "store", storeId: storeS })).toEqual(["post_b", "prod_s"]);
    expect(await ids(harness, { kind: "store", storeId: storeT })).toEqual(["post_c", "prod_t"]);
    expect(await ids(harness, { kind: "store", storeId: storeS }, { type: "users" })).toEqual([]);
  });

  it("returns nothing for an unknown or closed store", async () => {
    const harness = await seed();
    expect(await ids(harness, { kind: "store", storeId: "66666666-6666-4666-8666-666666666666" })).toEqual([]);
    harness.hydrator.stores.set(storeS, storeSource({ storeId: storeS, active: false }));
    harness.hydrator.products.set("prod_s", productSource({ productId: "prod_s", storeId: storeS, storeActive: false }));
    await harness.processor.process(envelope("store.updated", { storeId: storeS }, later));
    await harness.processor.process(envelope("product.updated", { productId: "prod_s", storeId: storeS }, later));
    expect(await ids(harness, { kind: "store", storeId: storeS })).toEqual([]);
  });

  it("hides the store from viewers the owner blocked", async () => {
    const harness = await seed();
    await harness.processor.process(envelope("block.created", { blockerId: accountB, blockedId: accountA }));
    expect(await ids(harness, { kind: "store", storeId: storeS }, { viewerId: accountA })).toEqual([]);
    expect(await ids(harness, { kind: "store", storeId: storeS }, { viewerId: accountC })).toEqual(["post_b", "prod_s"]);
  });
});

describe("profile scope", () => {
  it("never leaks another user's content", async () => {
    const harness = await seed();
    expect(await ids(harness, profile(accountA))).toEqual(["clip_a", "post_a"]);
    expect(await ids(harness, profile(accountC))).toEqual(["post_c", "prod_t"]);
    expect(await ids(harness, profile(accountA), { viewerId: accountC })).toEqual(["clip_a", "post_a"]);
    expect(await ids(harness, profile(accountA), { type: "users" })).toEqual([]);
  });

  it("hides a private profile's content from strangers but not from followers or the owner", async () => {
    const harness = await seed();
    await harness.processor.process(envelope("profile.visibilityChanged", { accountId: accountA, profileId: accountA, isPrivate: true }));
    await harness.processor.process(envelope("follow.created", { followerId: accountB, followeeId: accountA }));
    expect(await ids(harness, profile(accountA))).toEqual([]);
    expect(await ids(harness, profile(accountA), { viewerId: accountC })).toEqual([]);
    expect(await ids(harness, profile(accountA), { viewerId: accountB })).toEqual(["clip_a", "post_a"]);
    expect(await ids(harness, profile(accountA), { viewerId: accountA })).toEqual(["clip_a", "post_a"]);
  });

  it("hides subscriber-only, follower-only and minor-restricted posts from viewers without access", async () => {
    const harness = await seed();
    harness.hydrator.posts.set("post_a", postSource({ postId: "post_a", visibility: "subscribers" }));
    harness.hydrator.posts.set("clip_a", postSource({ postId: "clip_a", kind: "clip", caption: "Sneakers unboxing", audience: "followers" }));
    harness.hydrator.posts.set("post_x", postSource({ postId: "post_x", caption: "Sneakers after dark", sensitiveLabels: ["nudity"] }));
    for (const postId of ["post_a", "clip_a", "post_x"]) await harness.processor.process(envelope("post.created", { postId }, later));
    expect(await ids(harness, profile(accountA), { viewerId: accountC })).toEqual([]);
    expect(await ids(harness, profile(accountA), { viewerId: accountC, viewerIsAdult: true })).toEqual(["post_x"]);
    await harness.processor.process(envelope("follow.created", { followerId: accountC, followeeId: accountA }));
    expect(await ids(harness, profile(accountA), { viewerId: accountC })).toEqual(["clip_a"]);
  });

  it("returns nothing for blocked or suspended accounts", async () => {
    const harness = await seed();
    await harness.processor.process(envelope("block.created", { blockerId: accountA, blockedId: accountC }));
    expect(await ids(harness, profile(accountA), { viewerId: accountC })).toEqual([]);
    harness.hydrator.users.set(accountA, userSource({ status: "suspended" }));
    await harness.processor.process(envelope("account.suspended", { accountId: accountA }, later));
    expect(await ids(harness, profile(accountA))).toEqual([]);
  });
});
