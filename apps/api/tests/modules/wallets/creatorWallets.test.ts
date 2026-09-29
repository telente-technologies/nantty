import { randomUUID } from "node:crypto";

import { UnprocessableEntityError } from "@zudojs/errors";
import { afterAll, describe, expect, it } from "vitest";

import { Money } from "../../../src/utils/money.util.js";
import type { SignedInUser } from "../../fixtures/testApplication.fixture.js";
import { createCommerceTestApplication, createIdempotencyKey, FAKE_WEBHOOK_SECRET, naira } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

const creatorWallets = () => app.dependencies.ports.creatorWallets;

async function startTopUp(user: SignedInUser, amount: number) {
  const response = await app.client
    .post("/api/v1/wallets/me/top-ups")
    .auth(user.accessToken)
    .set("idempotency-key", createIdempotencyKey())
    .send({ amount, currency: "NGN", provider: "paystack" })
    .expect(201);
  return response.json<{ reference: string; authorizationUrl: string; callbackUrl: string }>();
}

async function personalBalance(user: SignedInUser): Promise<number> {
  const wallet = (await app.client.get("/api/v1/wallets/me?scope=user&currency=NGN").auth(user.accessToken).expect(200)).json<{ balances: { currency: string; availableBalance: { amountMinor: number } }[] }>();
  return wallet.balances.find((balance) => balance.currency === "NGN")?.availableBalance.amountMinor ?? 0;
}

async function topUp(user: SignedInUser, amount: number): Promise<void> {
  const started = await startTopUp(user, amount);
  await app.client.post(`/api/v1/wallets/me/top-ups/${started.reference}/verify`).auth(user.accessToken).expect(200).expectJson({ status: "succeeded" });
}

describe("wallet top-ups", () => {
  it("credits the personal wallet only after the provider confirms the payment", async () => {
    const user = await app.registerUser();
    const started = await startTopUp(user, 50_000);
    expect(started.callbackUrl).toBe(`zudomart://payments/return?reference=${started.reference}`);
    expect(await personalBalance(user)).toBe(0);
    app.paystack.verificationOverrides.set(started.reference, { status: "pending" });
    await app.client.post(`/api/v1/wallets/me/top-ups/${started.reference}/verify`).auth(user.accessToken).expect(200).expectJson({ status: "pending" });
    expect(await personalBalance(user)).toBe(0);
    app.paystack.verificationOverrides.delete(started.reference);
    const stranger = await app.registerUser();
    await app.client.post(`/api/v1/wallets/me/top-ups/${started.reference}/verify`).auth(stranger.accessToken).expect(404);
    await app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send({ id: `evt_${started.reference}`, reference: started.reference }).expect(200);
    await app.client.post(`/api/v1/wallets/me/top-ups/${started.reference}/verify`).auth(user.accessToken).expect(200).expectJson({ status: "succeeded" });
    expect(await personalBalance(user)).toBe(50_000);

    const failed = await startTopUp(user, 10_000);
    app.paystack.verificationOverrides.set(failed.reference, { status: "failed" });
    await app.client.post(`/api/v1/wallets/me/top-ups/${failed.reference}/verify`).auth(user.accessToken).expect(200).expectJson({ status: "failed" });
    const underpaid = await startTopUp(user, 10_000);
    app.paystack.verificationOverrides.set(underpaid.reference, { amount: 100 });
    await app.client.post(`/api/v1/wallets/me/top-ups/${underpaid.reference}/verify`).auth(user.accessToken).expect(422);
    expect(await personalBalance(user)).toBe(50_000);
    await app.client.post("/api/v1/wallets/me/top-ups").auth(user.accessToken).send({ amount: 5_000, currency: "NGN", provider: "paystack" }).expect(400);
  });
});

describe("creator wallets", () => {
  it("pays a live gift from viewer to creator minus the platform cut, idempotently, and refuses overdrafts", async () => {
    const viewer = await app.registerUser();
    const creator = await app.registerUser();
    await topUp(viewer, 20_000);
    const reference = randomUUID();
    const gift = { reference, senderUserId: viewer.userId, recipientUserId: creator.userId, amount: Money.of(10_000, "NGN"), platformCutBasisPoints: 3_000 };
    await creatorWallets().payForLiveGift(gift);
    await creatorWallets().payForLiveGift(gift);
    expect(await personalBalance(viewer)).toBe(10_000);
    expect(await personalBalance(creator)).toBe(7_000);
    expect((await creatorWallets().findUserWalletSummary(creator.userId)).balances.map((balance) => balance.toDto())).toEqual([naira(7_000)]);
    await expect(creatorWallets().payForLiveGift({ ...gift, reference: randomUUID(), amount: Money.of(10_001, "NGN") })).rejects.toBeInstanceOf(UnprocessableEntityError);
    await expect(creatorWallets().payForLiveGift({ ...gift, reference: randomUUID(), recipientUserId: viewer.userId })).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(await personalBalance(viewer)).toBe(10_000);
    const transactions = (await app.client.get("/api/v1/wallets/me/transactions?scope=user&currency=NGN").auth(creator.accessToken).expect(200)).json<{ data: { type: string; amount: unknown }[] }>();
    expect(transactions.data).toEqual([expect.objectContaining({ type: "credit", amount: naira(7_000) })]);
  });

  it("credits affiliate commission from the store wallet once per reference", async () => {
    const buyer = await app.registerBuyer();
    const creator = await app.registerUser();
    const store = await app.createStoreWithProduct({ price: 20_000 });
    const placed = await app.buyAndPay(buyer, store);
    await app.client.post(`/api/v1/orders/${placed.orders[0]?.id}/confirm-receipt`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200);
    const credit = { reference: `order:${placed.orders[0]?.id}`, storeId: store.storeId, creatorUserId: creator.userId, amount: Money.of(1_500, "NGN") };
    await creatorWallets().creditAffiliateCommission(credit);
    await creatorWallets().creditAffiliateCommission(credit);
    expect(await personalBalance(creator)).toBe(1_500);
    const storeWallet = (await app.client.get(`/api/v1/wallets/me?storeId=${store.storeId}`).auth(store.seller.accessToken).expect(200)).json<{ availableBalance: unknown }>();
    expect(storeWallet.availableBalance).toEqual(naira(19_000 - 1_500));
    await expect(creatorWallets().creditAffiliateCommission({ ...credit, reference: randomUUID(), amount: Money.of(100, "USD") })).rejects.toBeInstanceOf(UnprocessableEntityError);
    await expect(creatorWallets().creditAffiliateCommission({ ...credit, reference: randomUUID(), amount: Money.of(1_000_000, "NGN") })).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});

describe("personal wallet for users without a store", () => {
  it("manages payout accounts and withdrawals in the user scope and keeps store wallets for sellers", async () => {
    const user = await app.registerUser();
    await topUp(user, 30_000);
    await app.client.get("/api/v1/wallets/me").auth(user.accessToken).expect(403);
    const account = await app.client
      .post("/api/v1/wallets/me/payout-accounts?scope=user&currency=NGN")
      .auth(user.accessToken)
      .send({ bankCode: "058", accountNumber: "0123456789", accountName: "Ada Obi" })
      .expect(201);
    const payoutAccountId = account.json<{ id: string; accountNumber: string }>().id;
    expect(account.json<{ accountNumber: string }>().accountNumber).toBe("******6789");
    await app.client.post("/api/v1/wallets/me/withdrawals?scope=user&currency=NGN").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ amount: 40_000, payoutAccountId }).expect(422);
    const withdrawal = (await app.client.post("/api/v1/wallets/me/withdrawals?scope=user&currency=NGN").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ amount: 25_000, payoutAccountId }).expect(201)).json<{ id: string; userId: string; storeId: null }>();
    expect(withdrawal).toMatchObject({ userId: user.userId, storeId: null });
    expect(await personalBalance(user)).toBe(5_000);
    const admin = await app.registerAdmin();
    await app.client.post(`/api/v1/admin/withdrawals/${withdrawal.id}/process`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200).expectJson({ status: "paid" });
    expect(app.paystack.transfers.at(-1)).toMatchObject({ amount: 25_000, accountNumber: "0123456789" });
    const listed = (await app.client.get("/api/v1/wallets/me/withdrawals?scope=user").auth(user.accessToken).expect(200)).json<{ data: { id: string; status: string }[] }>();
    expect(listed.data.map((item) => item.status).sort()).toEqual(["failed", "paid"]);
    expect(listed.data.map((item) => item.id)).toContain(withdrawal.id);
  });
});
