import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createIdempotencyKey } from "../orders/commerceSetup.fixture.js";
import { registerApprovedCreator } from "./creatorSetup.fixture.js";
import { FakeCreatorWallets } from "./fakeCreatorWallets.fixture.js";

const wallets = new FakeCreatorWallets();
const app = createTestApplication({ external: { creatorWallets: wallets } });
afterAll(() => app.close());

interface MoneyBody {
  readonly amountMinor: number;
  readonly currency: string;
}

async function startLive(): Promise<{ hostToken: string; hostId: string; liveId: string }> {
  const host = await registerApprovedCreator(app);
  const live = (await app.client.post("/api/v1/lives").auth(host.accessToken).send({ title: "Gift me" }).expect(201)).json<{ id: string }>();
  return { hostToken: host.accessToken, hostId: host.userId, liveId: live.id };
}

describe("live gifts", () => {
  it("lists the gift catalog with prices per currency", async () => {
    const catalog = (await app.client.get("/api/v1/gifts").set("x-currency", "NGN").expect(200)).json<{ data: { id: string; price: MoneyBody; prices: MoneyBody[] }[] }>();
    const rose = catalog.data.find((gift) => gift.id === "rose");
    expect(rose?.prices.map((price) => price.currency)).toEqual(expect.arrayContaining(["NGN", "USD", "GHS"]));
    expect(rose?.price.amountMinor).toBeGreaterThan(0);
  });

  it("charges the viewer once per Idempotency-Key and records the creator's net earning", async () => {
    const { hostToken, hostId, liveId } = await startLive();
    const viewer = await app.registerUser();
    await app.client.post(`/api/v1/lives/${liveId}/gifts`).auth(viewer.accessToken).send({ giftId: "rose" }).expect(400);
    const key = createIdempotencyKey();
    const first = (await app.client.post(`/api/v1/lives/${liveId}/gifts`).auth(viewer.accessToken).set("idempotency-key", key).send({ giftId: "fire", quantity: 2 }).expect(201)).json<{ id: string; amount: MoneyBody }>();
    const replay = await app.client.post(`/api/v1/lives/${liveId}/gifts`).auth(viewer.accessToken).set("idempotency-key", key).send({ giftId: "fire", quantity: 2 }).expect(201);
    expect(replay.json<{ id: string }>().id).toBe(first.id);
    const payments = [...wallets.giftPayments.values()].filter((payment) => payment.recipientUserId === hostId);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ senderUserId: viewer.userId, platformCutBasisPoints: 3_000 });
    expect(payments[0]?.amount.amountMinor).toBe(first.amount.amountMinor);

    const earnings = (await app.client.get("/api/v1/creators/earnings").auth(hostToken).expect(200)).json<{ data: { kind: string; amount: MoneyBody; grossAmount: MoneyBody; source: { type: string; id: string } }[] }>();
    expect(earnings.data).toHaveLength(1);
    expect(earnings.data[0]).toMatchObject({ kind: "gift", source: { type: "live", id: liveId }, grossAmount: first.amount });
    expect(earnings.data[0]?.amount.amountMinor).toBe(first.amount.amountMinor - Math.floor((first.amount.amountMinor * 3_000) / 10_000));

    const dashboard = (await app.client.get("/api/v1/creators/dashboard?period=today").auth(hostToken).expect(200)).json<{ live: { sessionsHosted: number; giftsReceived: number }; earnings: { gifts: MoneyBody[] } }>();
    expect(dashboard.live).toMatchObject({ sessionsHosted: 1, giftsReceived: 1 });
    expect(dashboard.earnings.gifts).toEqual([earnings.data[0]?.amount]);
    const notifications = (await app.client.get("/api/v1/notifications").auth(hostToken).expect(200)).json<{ data: { title: string }[] }>();
    expect(notifications.data.map((item) => item.title)).toContain("New gift");
  });

  it("rejects gifts to yourself, unknown gifts, ended lives and wallets without enough money", async () => {
    const { hostToken, liveId } = await startLive();
    const viewer = await app.registerUser();
    const send = (token: string, giftId: string) => app.client.post(`/api/v1/lives/${liveId}/gifts`).auth(token).set("idempotency-key", createIdempotencyKey()).send({ giftId });
    await send(hostToken, "rose").expect(422);
    await send(viewer.accessToken, "diamond-car").expect(422);
    wallets.brokeUserIds.add(viewer.userId);
    const broke = await send(viewer.accessToken, "rose");
    expect(broke.status).toBe(422);
    expect(broke.text).toContain("Insufficient funds");
    wallets.brokeUserIds.delete(viewer.userId);
    await app.client.post(`/api/v1/lives/${liveId}/end`).auth(hostToken).expect(200);
    await send(viewer.accessToken, "rose").expect(422);
  });

  it("does not let suspended creators receive gifts", async () => {
    const { hostId, liveId } = await startLive();
    const viewer = await app.registerUser();
    const admin = await app.registerAdmin();
    await app.client.post(`/api/v1/admin/creators/${hostId}/suspend`).auth(admin.accessToken).send({ reason: "Review" }).expect(200);
    await app.client.post(`/api/v1/lives/${liveId}/gifts`).auth(viewer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ giftId: "rose" }).expect(422);
  });
});
