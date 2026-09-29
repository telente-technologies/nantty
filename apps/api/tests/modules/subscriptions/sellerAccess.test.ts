import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

type Access = { storeId: string; storeName: string; role: string; verificationStatus: string; subscription: { status: string; plan: string; currentPeriodEnd: string | null } | null; hasSellerToolsAccess: boolean };

async function subscribeGold(accessToken: string, storeId: string, plan = "PRO") {
  const checkout = await app.client.post(`/api/v1/seller/subscription/checkout?storeId=${storeId}`).auth(accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan }).expect(201);
  await app.client.post("/api/v1/seller/subscription/verify").auth(accessToken).send({ reference: checkout.json<{ reference: string }>().reference }).expect(200);
}

async function verifyStore(accessToken: string, storeId: string) {
  await app.client.post("/api/v1/verification/apply").auth(accessToken).send({ profileType: "STORE", storeId }).expect(201);
  const admin = await app.registerAdmin();
  await app.client.post(`/api/v1/verification/${storeId}/approve`).auth(admin.accessToken).send({}).expect(200);
}

describe("seller access gating", () => {
  it("requires a Gold verified store with an active Gold plan for the dashboard, while basic order management stays open", async () => {
    const store = await app.createStoreWithProduct();
    const token = store.seller.accessToken;
    const dashboard = () => app.client.get(`/api/v1/seller/dashboard?storeId=${store.storeId}`).auth(token);
    await dashboard().expect(403);
    await app.client.get(`/api/v1/seller/orders?storeId=${store.storeId}`).auth(token).expect(200);
    const before = (await app.client.get("/api/v1/seller/access").auth(token).expect(200)).json<Access>();
    expect(before).toMatchObject({ storeId: store.storeId, role: "owner", verificationStatus: "UNVERIFIED", subscription: null, hasSellerToolsAccess: false });

    await subscribeGold(token, store.storeId);
    await dashboard().expect(403);
    await verifyStore(token, store.storeId);
    await dashboard().expect(200);
    const after = (await app.client.get(`/api/v1/seller/access?storeId=${store.storeId}`).auth(token).expect(200)).json<Access>();
    expect(after).toMatchObject({ verificationStatus: "VERIFIED", subscription: { status: "ACTIVE", plan: "PRO" }, hasSellerToolsAccess: true });
    await app.client.get(`/api/v1/verification/${store.storeId}`).expect(200).expectJson({ color: "GOLD", tier: "PRO", badgeVisible: true });
    const entitlements = await app.dependencies.ports.entitlements.findEntitlementsForStore(store.storeId);
    expect(entitlements).toMatchObject({ color: "GOLD", tier: "PRO", entitlements: { "seller.pos": true, "store.staff_seats": 3 } });
    const summaries = await app.dependencies.ports.storeAccess.findStoreSummaries([store.storeId]);
    expect(summaries[0]?.verification).toMatchObject({ status: "VERIFIED", color: "GOLD", badgeVisible: true });

    const stranger = await app.registerSeller();
    await app.client.get(`/api/v1/seller/dashboard?storeId=${store.storeId}`).auth(stranger.accessToken).expect(403);
    await expect(app.dependencies.ports.sellerAccess.assertStoreHasActiveSellerAccess(store.seller.userId, store.storeId, "api.access")).rejects.toThrow("does not include");

    await app.client.post("/api/v1/seller/subscription/cancel").query({ storeId: store.storeId }).auth(token).expect(200).expectJson({ status: "CANCELLED" });
    await dashboard().expect(200);
    await app.client.post("/api/v1/seller/subscription/resume").query({ storeId: store.storeId }).auth(token).expect(200).expectJson({ status: "ACTIVE" });
    const admin = await app.registerAdmin();
    await app.client.post(`/api/v1/subscriptions/${store.storeId}/suspend`).auth(admin.accessToken).expect(200);
    await dashboard().expect(403);
  });

  it("lists Gold plans in the store currency and lets admins manage typed entitlements that gate access", async () => {
    const store = await app.createStoreWithProduct({ currency: "GHS" });
    const token = store.seller.accessToken;
    const plans = (await app.client.get(`/api/v1/seller/subscription/plans?storeId=${store.storeId}`).auth(token).expect(200)).json<{ data: { tier: string; prices: { monthly: { currency: string } } }[] }>();
    expect(plans.data.map((plan) => plan.tier)).toEqual(["PRO", "PREMIUM"]);
    expect(plans.data[0]?.prices.monthly.currency).toBe("USD");
    const nairaStore = await app.createStoreWithProduct({ currency: "NGN" });
    const nairaPlans = (await app.client.get(`/api/v1/seller/subscription/plans?storeId=${nairaStore.storeId}`).auth(nairaStore.seller.accessToken).expect(200)).json<{ data: { prices: { monthly: unknown } }[] }>();
    expect(nairaPlans.data[0]?.prices.monthly).toEqual({ amountMinor: 1_500_000, currency: "NGN" });
    const bluePlans = (await app.client.get("/api/v1/subscriptions/plans").expect(200)).json<{ data: { tier: string }[] }>();
    expect(bluePlans.data.map((plan) => plan.tier)).toEqual(["ESSENTIAL", "VERIFIED", "PREMIUM"]);

    await subscribeGold(nairaStore.seller.accessToken, nairaStore.storeId);
    await verifyStore(nairaStore.seller.accessToken, nairaStore.storeId);
    await app.client.get(`/api/v1/seller/dashboard?storeId=${nairaStore.storeId}`).auth(nairaStore.seller.accessToken).expect(200);

    const admin = await app.registerAdmin();
    const allPlans = (await app.client.get("/api/v1/admin/subscription-plans").auth(admin.accessToken).expect(200)).json<{ data: { id: string; color: string; tier: string }[] }>();
    const goldPro = allPlans.data.find((plan) => plan.color === "GOLD" && plan.tier === "PRO");
    const path = `/api/v1/admin/subscription-plans/${goldPro?.id}/entitlements`;
    await app.client.put(path).auth(token).send({ entitlements: [] }).expect(403);
    await app.client.put(path).auth(admin.accessToken).send({ entitlements: [{ key: "seller.dashboard", value: 3 }] }).expect(422);
    await app.client.put(path).auth(admin.accessToken).send({ entitlements: [{ key: "seller.dashboard", value: false }, { key: "badge.visible", value: true }] }).expect(200);
    await app.client.get(`/api/v1/seller/dashboard?storeId=${nairaStore.storeId}`).auth(nairaStore.seller.accessToken).expect(403);
    await app.client.put(path).auth(admin.accessToken).send({ entitlements: [{ key: "seller.dashboard", value: true }] }).expect(200);
    await app.client.get(`/api/v1/seller/dashboard?storeId=${nairaStore.storeId}`).auth(nairaStore.seller.accessToken).expect(200);
    await app.client.put(`/api/v1/admin/subscription-plans/${goldPro?.id}/perks`).auth(admin.accessToken).send({ perks: [{ title: "Gold badge" }] }).expect(200).expectJson({ perks: [{ title: "Gold badge", description: "" }] });
    const audit = (await app.client.get("/api/v1/admin/audit-events").query({ entityId: goldPro?.id }).auth(admin.accessToken).expect(200)).json<{ data: unknown[] }>();
    expect(audit.data.length).toBeGreaterThanOrEqual(3);
  });

  it("refuses Blue plans for stores and Gold checkout for non-sellers", async () => {
    const store = await app.createStoreWithProduct();
    await app.client.post(`/api/v1/seller/subscription/checkout?storeId=${store.storeId}`).auth(store.seller.accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan: "VERIFIED" }).expect(400);
    const buyer = await app.registerUser();
    await app.client.post(`/api/v1/seller/subscription/checkout?storeId=${store.storeId}`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan: "PRO" }).expect(403);
  });
});
