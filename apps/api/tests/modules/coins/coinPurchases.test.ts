import { afterAll, describe, expect, it } from "vitest";

import { createDefaultMonetizationSettings } from "../../../src/configs/monetization.config.js";
import { chooseCoinPurchaseChannel } from "../../../src/modules/coins/services/coinPurchaseChannel.service.js";
import type { InMemoryLedgerRepository } from "../../../src/modules/wallets/repositories/ledger.repository.js";
import type { StoreReceiptVerifier, VerifiedStoreReceipt } from "../../../src/modules/coins/gateways/storeReceiptVerifier.gateway.js";
import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createCommerceTestApplication, createIdempotencyKey } from "../orders/commerceSetup.fixture.js";
import { readCoinBalance, startCoinPurchase } from "./coinsSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

describe("coin packs and web checkout purchases", () => {
  it("lists packs in the viewer's currency and lets admins edit them", async () => {
    const packs = (await app.client.get("/api/v1/coins/packages").set("cf-ipcountry", "NG").expect(200)).json<{ data: { id: string; coins: number; price: { currency: string } }[] }>();
    expect(packs.data.map((pack) => pack.id)).toContain("coins-70");
    expect(packs.data[0]?.price.currency).toBe("NGN");
    const user = await app.registerUser();
    const body = { name: "Starter", coins: 10, prices: [{ currency: "USD", amountMinor: 15 }] };
    await app.client.put("/api/v1/admin/coin-packs/coins-10").auth(user.accessToken).send(body).expect(403);
    const admin = await app.registerAdmin();
    await app.client.put("/api/v1/admin/coin-packs/coins-10").auth(admin.accessToken).send(body).expect(200);
    const all = (await app.client.get("/api/v1/admin/coin-packs").auth(admin.accessToken).expect(200)).json<{ data: { id: string }[] }>();
    expect(all.data.map((pack) => pack.id)).toContain("coins-10");
  });

  it("credits coins only after the provider verifies the payment", async () => {
    const buyer = await app.registerBuyer();
    await app.client.post("/api/v1/coins/purchases").auth(buyer.accessToken).send({ packId: "coins-700" }).expect(400);
    const started = await startCoinPurchase(app, buyer);
    expect(started.purchaseChannel).toBe("web_checkout");
    expect(started.authorizationUrl).toContain(started.reference);
    expect(started.callbackUrl).toBe(`zudomart://payments/return?reference=${started.reference}`);
    expect((await readCoinBalance(app, buyer)).coins).toBe(0);
    app.paystack.verificationOverrides.set(started.reference, { status: "pending" });
    const pending = (await app.client.post(`/api/v1/coins/purchases/${started.reference}/verify`).auth(buyer.accessToken).expect(200)).json<{ status: string }>();
    expect(pending.status).toBe("pending");
    expect((await readCoinBalance(app, buyer)).coins).toBe(0);
    app.paystack.verificationOverrides.delete(started.reference);
    const stranger = await app.registerUser();
    await app.client.post(`/api/v1/coins/purchases/${started.reference}/verify`).auth(stranger.accessToken).expect(404);
    const verified = (await app.client.post(`/api/v1/coins/purchases/${started.reference}/verify`).auth(buyer.accessToken).expect(200)).json<{ status: string; coins: number; balance: number }>();
    expect(verified).toMatchObject({ status: "succeeded", coins: 735, balance: 735 });
    await app.client.post(`/api/v1/coins/purchases/${started.reference}/verify`).auth(buyer.accessToken).expect(200);
    expect((await readCoinBalance(app, buyer)).coins).toBe(735);

    const underpaid = await startCoinPurchase(app, buyer, "coins-70");
    app.paystack.verificationOverrides.set(underpaid.reference, { amount: 1 });
    await app.client.post(`/api/v1/coins/purchases/${underpaid.reference}/verify`).auth(buyer.accessToken).expect(422);
    expect((await readCoinBalance(app, buyer)).coins).toBe(735);
    const history = (await app.client.get("/api/v1/coins/transactions").auth(buyer.accessToken).expect(200)).json<{ data: { type: string; coins: number }[] }>();
    expect(history.data).toEqual([expect.objectContaining({ type: "credit", coins: 735 })]);
  });

  it("keeps every ledger currency and the COIN unit balanced", async () => {
    const repository = app.dependencies.ports.ledger.repository as InMemoryLedgerRepository;
    for (const transaction of repository.listAllTransactions()) {
      const totals = new Map<string, number>();
      for (const entry of transaction.entries) totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + (entry.direction === "debit" ? entry.amount : -entry.amount));
      for (const total of totals.values()) expect(total).toBe(0);
    }
    const coinSales = repository.listAllAccounts().find((account) => account.key === "revenue:coin-sales:NGN");
    expect(coinSales?.balance).toBe(1_500_000);
    expect(repository.listAllAccounts().find((account) => account.key === "asset:coins-in-circulation:COIN")?.balance).toBe(735);
  });
});

class FakeAppStoreVerifier implements StoreReceiptVerifier {
  public readonly store = "apple" as const;

  public async verifyPurchaseReceipt(submission: { productId: string; receipt: string }): Promise<VerifiedStoreReceipt> {
    return { valid: submission.receipt === "good", transactionId: `txn-${submission.receipt}`, productId: submission.productId, priceAmount: 999, priceCurrency: "USD", failureReason: null };
  }
}

describe("coin purchase channel flag", () => {
  const monetization = createDefaultMonetizationSettings();
  const iosUsesStore = { ...monetization, coins: { ...monetization.coins, purchaseChannelRules: [{ platform: "ios" as const, countryCode: null, channel: "store_iap" as const }] } };
  const configured = createTestApplication({ settings: { monetization: iosUsesStore }, external: { appStoreReceiptVerifier: new FakeAppStoreVerifier() } });
  const unconfigured = createTestApplication({ settings: { monetization: iosUsesStore } });
  const webOnly = createTestApplication();
  afterAll(() => Promise.all([configured.close(), unconfigured.close(), webOnly.close()]));

  it("routes iOS to in-app purchases when the flag says so, and web stays on checkout", async () => {
    const user = await configured.registerUser();
    const ios = await configured.client.post("/api/v1/coins/purchases?platform=ios").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ packId: "coins-700" }).expect(201);
    expect(ios.json()).toMatchObject({ purchaseChannel: "store_iap", storeProductId: "zudomart.coins.700", authorizationUrl: null });
    expect(chooseCoinPurchaseChannel(iosUsesStore, "web", "NG")).toBe("web_checkout");
    expect(chooseCoinPurchaseChannel(iosUsesStore, "android", "NG")).toBe("web_checkout");
    const nigeriaOnWeb = { ...iosUsesStore, coins: { ...iosUsesStore.coins, purchaseChannelRules: [...iosUsesStore.coins.purchaseChannelRules, { platform: "ios" as const, countryCode: "NG", channel: "web_checkout" as const }] } };
    expect(chooseCoinPurchaseChannel(nigeriaOnWeb, "ios", "NG")).toBe("web_checkout");
    expect(chooseCoinPurchaseChannel(nigeriaOnWeb, "ios", "GB")).toBe("store_iap");
    const receipt = { platform: "ios", productId: "zudomart.coins.700", receipt: "good" };
    await configured.client.post("/api/v1/coins/iap/receipts").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ ...receipt, receipt: "bad" }).expect(422);
    const redeemed = (await configured.client.post("/api/v1/coins/iap/receipts").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send(receipt).expect(201)).json<{ balance: number }>();
    expect(redeemed.balance).toBe(735);
    await configured.client.post("/api/v1/coins/iap/receipts").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send(receipt).expect(201);
    const other = await configured.registerUser();
    await configured.client.post("/api/v1/coins/iap/receipts").auth(other.accessToken).set("idempotency-key", createIdempotencyKey()).send(receipt).expect(409);
    expect((await configured.client.get("/api/v1/coins/balance").auth(user.accessToken).expect(200)).json<{ coins: number }>().coins).toBe(735);
  });

  it("answers 501 when store receipts are enabled but not configured, and 409 when the flag is off", async () => {
    const user = await unconfigured.registerUser();
    const receipt = { platform: "ios", productId: "zudomart.coins.700", receipt: "anything" };
    const response = await unconfigured.client.post("/api/v1/coins/iap/receipts").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send(receipt).expect(501);
    expect(response.json<{ code: string }>().code).toBe("IAP_NOT_CONFIGURED");
    const webUser = await webOnly.registerUser();
    await webOnly.client.post("/api/v1/coins/iap/receipts").auth(webUser.accessToken).set("idempotency-key", createIdempotencyKey()).send(receipt).expect(409);
  });
});
