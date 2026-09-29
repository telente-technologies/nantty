import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, naira, type MoneyShape } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

async function sellerWithEarnings(price: number) {
  const buyer = await app.registerBuyer();
  const store = await app.createStoreWithProduct({ price });
  const placed = await app.buyAndPay(buyer, store);
  await app.client.post(`/api/v1/orders/${placed.orders[0]?.id ?? ""}/confirm-receipt`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200);
  const account = await app.client
    .post(`/api/v1/wallets/me/payout-accounts?storeId=${store.storeId}`)
    .auth(store.seller.accessToken)
    .send({ bankCode: "058", bankName: "GTBank", accountNumber: "0123456789", accountName: "Shop Owner" })
    .expect(201);
  return { store, payoutAccountId: account.json<{ id: string }>().id };
}

function requestWithdrawal(accessToken: string, storeId: string, amount: number, payoutAccountId: string) {
  return app.client.post(`/api/v1/wallets/me/withdrawals?storeId=${storeId}`).auth(accessToken).set("idempotency-key", createIdempotencyKey()).send({ amount, payoutAccountId });
}

describe("store wallet", () => {
  it("stores payout accounts encrypted and returns only the last four digits", async () => {
    const { store } = await sellerWithEarnings(10_000);
    const accounts = await app.client.get(`/api/v1/wallets/me/payout-accounts?storeId=${store.storeId}`).auth(store.seller.accessToken).expect(200);
    expect(JSON.stringify(accounts.json())).not.toContain("0123456789");
    expect(accounts.json<{ accountNumber: string }[]>()[0]?.accountNumber).toBe("******6789");
  });

  it("keeps wallets private to store members", async () => {
    const { store } = await sellerWithEarnings(10_000);
    const otherSeller = await app.registerSeller();
    const buyer = await app.registerBuyer();
    await app.client.get(`/api/v1/wallets/me?storeId=${store.storeId}`).auth(otherSeller.accessToken).expect(403);
    await app.client.get(`/api/v1/wallets/me?storeId=${store.storeId}`).auth(buyer.accessToken).expect(403);
  });

  it("requires an Idempotency-Key and never lets concurrent withdrawals overdraw", async () => {
    const { store, payoutAccountId } = await sellerWithEarnings(20_000);
    await app.client.post(`/api/v1/wallets/me/withdrawals?storeId=${store.storeId}`).auth(store.seller.accessToken).send({ amount: 1_000, payoutAccountId }).expect(400);
    const attempts = await Promise.all(Array.from({ length: 4 }, () => requestWithdrawal(store.seller.accessToken, store.storeId, 7_000, payoutAccountId)));
    expect(attempts.filter((attempt) => attempt.status === 201)).toHaveLength(2);
    expect(attempts.filter((attempt) => attempt.status === 422)).toHaveLength(2);
    const wallet = (await app.client.get(`/api/v1/wallets/me?storeId=${store.storeId}`).auth(store.seller.accessToken).expect(200)).json<{ availableBalance: MoneyShape; pendingWithdrawals: MoneyShape }>();
    expect(wallet).toMatchObject({ availableBalance: naira(5_000), pendingWithdrawals: naira(14_000) });
    const transactions = (await app.client.get(`/api/v1/wallets/me/transactions?storeId=${store.storeId}`).auth(store.seller.accessToken).expect(200)).json<{ data: { type: string }[] }>();
    expect(transactions.data.map((entry) => entry.type).sort()).toEqual(["credit", "debit", "debit"]);
  });

  it("pays out a processed withdrawal and returns funds when the transfer fails", async () => {
    const { store, payoutAccountId } = await sellerWithEarnings(10_000);
    const admin = await app.registerAdmin();
    const paid = (await requestWithdrawal(store.seller.accessToken, store.storeId, 4_000, payoutAccountId).expect(201)).json<{ id: string }>();
    await app.client.post(`/api/v1/admin/withdrawals/${paid.id}/process`).auth(store.seller.accessToken).set("idempotency-key", createIdempotencyKey()).expect(403);
    await app.client.post(`/api/v1/admin/withdrawals/${paid.id}/process`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200).expectJson({ status: "paid" });
    await app.client.post(`/api/v1/admin/withdrawals/${paid.id}/process`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).expect(409);
    expect(app.paystack.transfers.at(-1)).toMatchObject({ amount: 4_000, accountNumber: "0123456789" });

    app.paystack.transferResult = { status: "failed", recipientCode: "RCP_fake", failureReason: "account_closed" };
    const failed = (await requestWithdrawal(store.seller.accessToken, store.storeId, 5_000, payoutAccountId).expect(201)).json<{ id: string }>();
    await app.client.post(`/api/v1/admin/withdrawals/${failed.id}/process`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200).expectJson({ status: "failed" });
    app.paystack.transferResult = { status: "succeeded", recipientCode: "RCP_fake", failureReason: null };
    const wallet = (await app.client.get(`/api/v1/wallets/me?storeId=${store.storeId}`).auth(store.seller.accessToken).expect(200)).json<{ availableBalance: MoneyShape; pendingWithdrawals: MoneyShape }>();
    expect(wallet).toMatchObject({ availableBalance: naira(5_500), pendingWithdrawals: naira(0) });
    const audit = (await app.client.get("/api/v1/admin/audit-events").query({ entityType: "withdrawal" }).auth(admin.accessToken).expect(200)).json<{ data: { action: string }[] }>();
    expect(audit.data.map((item) => item.action)).toEqual(expect.arrayContaining(["wallets.withdrawal_requested", "wallets.withdrawal_succeeded", "wallets.withdrawal_failed"]));
  });
});
