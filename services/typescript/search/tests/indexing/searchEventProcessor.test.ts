import { describe, expect, it } from "vitest";

import { PoisonEventError } from "../../src/errors/search.error.js";
import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { accountA, accountB, accountC, postSource, productSource, storeSource, userSource } from "../fakes/sourceFixtures.fake.js";

describe("search event processor", () => {
  it("indexes a user from profile.updated and tombstones when the source is gone", async () => {
    const { store, hydrator, processor } = createSearchHarness();
    hydrator.users.set(accountA, userSource());
    await processor.process(envelope("profile.updated", { accountId: accountA, profileId: accountA, changedFields: ["bio"] }));
    expect(store.documents.get(`user:${accountA}`)?.available).toBe(true);
    hydrator.users.delete(accountA);
    await processor.process(envelope("account.deletionExecuted", { accountId: accountA }, "2026-10-03T11:00:00.000Z"));
    expect(store.documents.get(`user:${accountA}`)?.available).toBe(false);
    expect(store.accountStates.get(accountA)?.status).toBe("deleted");
  });

  it("is idempotent on the envelope id and releases the claim when hydration fails", async () => {
    const { store, hydrator, processor } = createSearchHarness();
    hydrator.stores.set("store_1", storeSource());
    const event = envelope("store.updated", { storeId: "store_1" });
    hydrator.failNext = true;
    await expect(processor.process(event)).rejects.toThrow("source unavailable");
    expect(store.processedEvents.has(event.id)).toBe(false);
    expect(await processor.process(event)).toBe("handled");
    expect(await processor.process(event)).toBe("duplicate");
  });

  it("does not let an older event overwrite a newer document", async () => {
    const { store, hydrator, processor } = createSearchHarness();
    hydrator.products.set("prod_1", productSource({ name: "Newest name" }));
    await processor.process(envelope("product.updated", { productId: "prod_1", storeId: "store_1", status: "published", visibility: "public" }, "2026-10-03T12:00:00.000Z"));
    hydrator.products.set("prod_1", productSource({ name: "Stale name" }));
    await processor.process(envelope("product.updated", { productId: "prod_1", storeId: "store_1", status: "published", visibility: "public" }, "2026-10-03T09:00:00.000Z"));
    expect(store.documents.get("product:prod_1")?.title).toBe("Newest name");
  });

  it("removes unpublished products from the index", async () => {
    const { store, hydrator, processor } = createSearchHarness();
    hydrator.products.set("prod_1", productSource());
    await processor.process(envelope("product.published", { productId: "prod_1", storeId: "store_1" }));
    hydrator.products.set("prod_1", productSource({ status: "draft" }));
    await processor.process(envelope("product.unpublished", { productId: "prod_1", storeId: "store_1" }, "2026-10-03T11:00:00.000Z"));
    expect(store.documents.get("product:prod_1")?.available).toBe(false);
  });

  it("maintains hashtag documents from posts and drops them when the post is deleted", async () => {
    const { store, hydrator, processor } = createSearchHarness();
    hydrator.posts.set("post_1", postSource());
    await processor.process(envelope("post.created", { postId: "post_1", authorId: accountA, kind: "post", audience: "everyone", visibility: "public", isAiGenerated: false }));
    expect(store.documents.get("hashtag:sneakers")?.available).toBe(true);
    await processor.process(envelope("post.deleted", { postId: "post_1", kind: "post" }, "2026-10-03T11:00:00.000Z"));
    expect(store.documents.get("post:post_1")?.available).toBe(false);
    expect(store.documents.get("hashtag:sneakers")?.available).toBe(false);
  });

  it("tracks blocks, follows, privacy and consent", async () => {
    const { store, processor } = createSearchHarness();
    await processor.process(envelope("block.created", { blockerId: accountA, blockedId: accountB }));
    await processor.process(envelope("follow.created", { followerId: accountA, followeeId: accountC }));
    await processor.process(envelope("profile.visibilityChanged", { accountId: accountC, profileId: accountC, isPrivate: true }));
    await processor.process(envelope("consent.granted", { accountId: accountA, consentType: "personalization" }));
    expect(store.blocks.has(`${accountA}>${accountB}`)).toBe(true);
    expect(store.follows.has(`${accountA}>${accountC}`)).toBe(true);
    expect(store.accountStates.get(accountC)?.isPrivate).toBe(true);
    expect(await store.hasConsent(accountA, "personalization")).toBe(true);
    await processor.process(envelope("consent.withdrawn", { accountId: accountA, consentType: "personalization" }));
    await processor.process(envelope("block.removed", { blockerId: accountA, blockedId: accountB }));
    expect(await store.hasConsent(accountA, "personalization")).toBe(false);
    expect(store.blocks.size).toBe(0);
  });

  it("ignores unrelated events and rejects malformed ones as poison", async () => {
    const { processor } = createSearchHarness();
    expect(await processor.process(envelope("order.created", {}))).toBe("ignored");
    await expect(processor.process(envelope("product.updated", {}))).rejects.toBeInstanceOf(PoisonEventError);
    await expect(processor.processBody("not json")).rejects.toBeInstanceOf(PoisonEventError);
  });
});
