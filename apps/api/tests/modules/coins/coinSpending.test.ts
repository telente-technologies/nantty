import { afterAll, describe, expect, it } from "vitest";

import type { InMemoryLedgerRepository } from "../../../src/modules/wallets/repositories/ledger.repository.js";
import { registerApprovedCreator } from "../creators/creatorSetup.fixture.js";
import { createCommerceTestApplication, createIdempotencyKey } from "../orders/commerceSetup.fixture.js";
import { buyCoins, readCoinBalance } from "./coinsSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

function assertEveryUnitBalances(): void {
  const repository = app.dependencies.ports.ledger.repository as InMemoryLedgerRepository;
  for (const transaction of repository.listAllTransactions()) {
    const totals = new Map<string, number>();
    for (const entry of transaction.entries) totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + (entry.direction === "debit" ? entry.amount : -entry.amount));
    for (const total of totals.values()) expect(total).toBe(0);
  }
}

function platformCoinFees(): number {
  const repository = app.dependencies.ports.ledger.repository as InMemoryLedgerRepository;
  return repository.listAllAccounts().find((account) => account.key === "revenue:coin-fees:COIN")?.balance ?? 0;
}

describe("coin transfers", () => {
  it("quotes and charges a 25% platform fee, idempotently, and refuses blocked users", async () => {
    const sender = await app.registerBuyer();
    const recipient = await app.registerUser();
    expect(await buyCoins(app, sender)).toBe(735);
    const quote = (await app.client.get("/api/v1/coins/transfers/quote?coins=100").auth(sender.accessToken).expect(200)).json();
    expect(quote).toMatchObject({ coins: 100, feeCoins: 25, netCoins: 75, feePercent: 25 });
    const feesBefore = platformCoinFees();
    const key = createIdempotencyKey();
    const send = () => app.client.post("/api/v1/coins/transfers").auth(sender.accessToken).set("idempotency-key", key).send({ recipientUserId: recipient.userId, coins: 100, note: "thanks" });
    const receipt = (await send().expect(201)).json<{ transferId: string; feeCoins: number; netCoins: number; balance: number }>();
    expect(receipt).toMatchObject({ feeCoins: 25, netCoins: 75, balance: 635 });
    expect((await send().expect(201)).json<{ transferId: string }>().transferId).toBe(receipt.transferId);
    expect((await readCoinBalance(app, recipient)).coins).toBe(75);
    expect((await readCoinBalance(app, sender)).coins).toBe(635);
    expect(platformCoinFees() - feesBefore).toBe(25);
    await app.client.post("/api/v1/coins/transfers").auth(sender.accessToken).send({ recipientUserId: recipient.userId, coins: 1 }).expect(400);
    await app.client.post("/api/v1/coins/transfers").auth(sender.accessToken).set("idempotency-key", createIdempotencyKey()).send({ recipientUserId: recipient.userId, coins: 10_000 }).expect(422);
    await app.client.post(`/api/v1/users/${sender.userId}/block`).auth(recipient.accessToken).expect(200);
    await app.client.post("/api/v1/coins/transfers").auth(sender.accessToken).set("idempotency-key", createIdempotencyKey()).send({ recipientUserId: recipient.userId, coins: 10 }).expect(422);
    assertEveryUnitBalances();
  });
});

describe("gifts and tips in coins", () => {
  it("prices the gift catalog in coins", async () => {
    const catalog = (await app.client.get("/api/v1/gifts").expect(200)).json<{ data: { id: string; priceCoins: number }[] }>();
    expect(catalog.data.find((gift) => gift.id === "fire")?.priceCoins).toBe(10);
  });

  it("splits live gifts, post gifts and tips 70/30 between creator and platform", async () => {
    const fan = await app.registerBuyer();
    await buyCoins(app, fan);
    const creator = await registerApprovedCreator(app);
    const live = (await app.client.post("/api/v1/lives").auth(creator.accessToken).send({ title: "Live" }).expect(201)).json<{ id: string }>();
    const post = (await app.client.post("/api/v1/posts").auth(creator.accessToken).send({ text: "Hello fans" }).expect(201)).json<{ id: string }>();
    const feesBefore = platformCoinFees();
    const liveGift = (await app.client.post(`/api/v1/lives/${live.id}/gifts`).auth(fan.accessToken).set("idempotency-key", createIdempotencyKey()).send({ giftId: "fire", quantity: 2 }).expect(201))
      .json<{ coins: number; coinBalance: number }>();
    expect(liveGift).toMatchObject({ coins: 20, coinBalance: 715 });
    const postGift = (await app.client.post(`/api/v1/posts/${post.id}/gifts`).auth(fan.accessToken).set("idempotency-key", createIdempotencyKey()).send({ giftId: "crown" }).expect(201))
      .json<{ coins: number; coinBalance: number }>();
    expect(postGift).toMatchObject({ coins: 50, coinBalance: 665 });
    const tipKey = createIdempotencyKey();
    const tip = (await app.client.post("/api/v1/tips").auth(fan.accessToken).set("idempotency-key", tipKey).send({ targetType: "post", targetId: post.id, coins: 30 }).expect(201)).json<{ tipId: string; balance: number }>();
    expect(tip.balance).toBe(635);
    await app.client.post("/api/v1/tips").auth(fan.accessToken).set("idempotency-key", tipKey).send({ targetType: "post", targetId: post.id, coins: 30 }).expect(201);
    await app.client.post("/api/v1/tips").auth(fan.accessToken).set("idempotency-key", createIdempotencyKey()).send({ targetType: "live", targetId: live.id, coins: 10 }).expect(201);
    await app.client.post("/api/v1/tips").auth(creator.accessToken).set("idempotency-key", createIdempotencyKey()).send({ targetType: "post", targetId: post.id, coins: 1 }).expect(422);
    const balances = await readCoinBalance(app, creator);
    expect(balances.earnedCoins).toBe(14 + 35 + 21 + 7);
    expect(platformCoinFees() - feesBefore).toBe(6 + 15 + 9 + 3);
    expect((await readCoinBalance(app, fan)).coins).toBe(625);
    const earnings = (await app.client.get("/api/v1/creators/earnings").auth(creator.accessToken).expect(200)).json<{ data: { kind: string; amount: { amountMinor: number; currency: string } }[] }>();
    expect(earnings.data.map((earning) => earning.kind).sort()).toEqual(["gift", "gift", "tip", "tip"]);
    expect(earnings.data.every((earning) => earning.amount.currency === "COIN")).toBe(true);
    const broke = await app.registerUser();
    const refused = await app.client.post(`/api/v1/posts/${post.id}/gifts`).auth(broke.accessToken).set("idempotency-key", createIdempotencyKey()).send({ giftId: "rose" });
    expect(refused.status).toBe(422);
    expect(refused.json<{ message: string }>().message).toContain("Insufficient");
    assertEveryUnitBalances();
  });
});
