import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { AttributedOrderItem, SaleAttributionSource } from "../../../src/interfaces/orderLookup.interface.js";
import { publishEvent } from "../../../src/loaders/events.loader.js";
import { EscrowReleasedEvent } from "../../../src/modules/escrows/events/escrowReleased.event.js";
import { createTestApplication, type SignedInUser } from "../../fixtures/testApplication.fixture.js";
import { createProductInStore, createStoreForSeller } from "../posts/catalogSetup.fixture.js";
import { approveCreator, registerApprovedCreator } from "./creatorSetup.fixture.js";
import { FakeCreatorWallets } from "./fakeCreatorWallets.fixture.js";

const wallets = new FakeCreatorWallets();
const app = createTestApplication({ external: { creatorWallets: wallets } });
const orderLookup = app.dependencies.ports.orderLookup;
afterAll(() => app.close());
afterEach(() => vi.restoreAllMocks());

async function createSellerWithProduct(): Promise<{ seller: SignedInUser; storeId: string; productId: string }> {
  const seller = await app.registerSeller();
  const storeId = await createStoreForSeller(app, seller, `Affiliate ${randomUUID().slice(0, 6)}`);
  return { seller, storeId, productId: await createProductInStore(app, seller, storeId) };
}

function stubReleasedOrder(orderId: string, storeId: string, productId: string, source: SaleAttributionSource, sourceId: string, buyerIsCreator = false): void {
  const items: AttributedOrderItem[] = [
    { orderId, storeId, productId, quantity: 1, lineTotal: 12_000, currency: "NGN", attributionSource: source, attributionId: sourceId },
    { orderId, storeId, productId, quantity: 1, lineTotal: 8_000, currency: "NGN", attributionSource: source, attributionId: sourceId },
  ];
  vi.spyOn(orderLookup, "listAttributedOrderItems").mockResolvedValue(items);
  vi.spyOn(orderLookup, "hasReceivedProductInOrder").mockResolvedValue(buyerIsCreator ? { storeId } : undefined);
}

async function releaseEscrow(orderId: string, storeId: string): Promise<void> {
  await publishEvent(app.dependencies.core.events, EscrowReleasedEvent, { escrowId: randomUUID(), orderId, storeId, amount: 20_000 });
}

async function createPost(creator: SignedInUser, productId: string): Promise<string> {
  return (await app.client.post("/api/v1/posts").auth(creator.accessToken).send({ text: "Love this", productIds: [productId] }).expect(201)).json<{ id: string }>().id;
}

describe("affiliate commissions", () => {
  it("lets sellers set store and product commissions within the configured cap", async () => {
    const { seller, storeId, productId } = await createSellerWithProduct();
    const buyer = await app.registerUser();
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(buyer.accessToken).send({ storeId, commissionBps: 1_000 }).expect(403);
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ storeId, commissionBps: 6_000 }).expect(422);
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ storeId, commissionBps: 1_000 }).expect(200).expectJson({ productId: null, commissionPercent: 10 });
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ productId, commissionBps: 1_500 }).expect(200).expectJson({ productId, commissionPercent: 15 });
    const other = await app.registerSeller();
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(other.accessToken).send({ productId, commissionBps: 100 }).expect(403);
    const listed = (await app.client.get(`/api/v1/seller/affiliates/commissions?storeId=${storeId}`).auth(seller.accessToken).expect(200)).json<{ data: unknown[] }>();
    expect(listed.data).toHaveLength(2);

    const creator = await registerApprovedCreator(app);
    await app.client.post("/api/v1/creators/affiliations").auth(creator.accessToken).send({ productId }).expect(201);
    const affiliations = (await app.client.get("/api/v1/creators/affiliations").auth(creator.accessToken).expect(200)).json<{ data: { productId: string; commissionPercent: number }[] }>();
    expect(affiliations.data).toEqual([expect.objectContaining({ productId, storeId, commissionPercent: 15, productTitle: "Ankara Dress" })]);
    await app.client.delete(`/api/v1/creators/affiliations?productId=${productId}`).auth(creator.accessToken).expect(200).expectJson({ data: [] });
    await app.client.delete(`/api/v1/seller/affiliates/commissions?productId=${productId}`).auth(seller.accessToken).expect(204);
    const outsider = await app.registerUser();
    await app.client.post("/api/v1/creators/affiliations").auth(outsider.accessToken).send({ productId }).expect(403);
  });

  it("credits the post author once per order and product when escrow is released", async () => {
    const { seller, storeId, productId } = await createSellerWithProduct();
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ productId, commissionBps: 1_500 }).expect(200);
    const creator = await registerApprovedCreator(app);
    const postId = await createPost(creator, productId);
    const orderId = randomUUID();
    stubReleasedOrder(orderId, storeId, productId, "post", postId);
    await releaseEscrow(orderId, storeId);
    await releaseEscrow(orderId, storeId);

    const credit = wallets.commissionCredits.get(`affiliate-commission:${orderId}:${productId}`);
    expect(credit).toMatchObject({ storeId, creatorUserId: creator.userId });
    expect(credit?.amount.toDto()).toEqual({ amountMinor: 3_000, currency: "NGN" });
    const earnings = (await app.client.get("/api/v1/creators/earnings").auth(creator.accessToken).expect(200)).json<{ data: { kind: string; orderId: string; amount: { amountMinor: number } }[] }>();
    expect(earnings.data).toEqual([expect.objectContaining({ kind: "affiliate", orderId, productId, amount: { amountMinor: 3_000, currency: "NGN" } })]);
    const dashboard = (await app.client.get("/api/v1/creators/dashboard?period=all").auth(creator.accessToken).expect(200)).json<{ earnings: { affiliate: unknown[] } }>();
    expect(dashboard.earnings.affiliate).toEqual([{ amountMinor: 3_000, currency: "NGN" }]);
  });

  it("credits the live host for live-attributed sales using the store-level commission", async () => {
    const { seller, storeId, productId } = await createSellerWithProduct();
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ storeId, commissionBps: 500 }).expect(200);
    const host = await registerApprovedCreator(app);
    const live = (await app.client.post("/api/v1/lives").auth(host.accessToken).send({ title: "Shop with me", productIds: [productId] }).expect(201)).json<{ id: string }>();
    const orderId = randomUUID();
    stubReleasedOrder(orderId, storeId, productId, "live", live.id);
    await releaseEscrow(orderId, storeId);
    expect(wallets.commissionCredits.get(`affiliate-commission:${orderId}:${productId}`)?.creatorUserId).toBe(host.userId);
  });

  it("pays nothing for self-referrals, the seller's own content or unapproved authors", async () => {
    const { seller, storeId, productId } = await createSellerWithProduct();
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(seller.accessToken).send({ storeId, commissionBps: 1_000 }).expect(200);
    const creator = await registerApprovedCreator(app);
    const selfOrderId = randomUUID();
    stubReleasedOrder(selfOrderId, storeId, productId, "post", await createPost(creator, productId), true);
    await releaseEscrow(selfOrderId, storeId);

    await approveCreator(app, seller);
    const sellerOrderId = randomUUID();
    stubReleasedOrder(sellerOrderId, storeId, productId, "post", await createPost(seller, productId));
    await releaseEscrow(sellerOrderId, storeId);

    const regularUser = await app.registerUser();
    const regularOrderId = randomUUID();
    stubReleasedOrder(regularOrderId, storeId, productId, "post", await createPost(regularUser, productId));
    await releaseEscrow(regularOrderId, storeId);

    for (const orderId of [selfOrderId, sellerOrderId, regularOrderId]) {
      expect(wallets.commissionCredits.has(`affiliate-commission:${orderId}:${productId}`)).toBe(false);
    }
  });
});
