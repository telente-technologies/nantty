import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, registerUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { psql } from "../src/commerceFixtures.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";
import { buyCoins, coinBalance, publishGiftAndCoinPack, registerApprovedCreator, startLive, withRelaxedCreatorThresholds } from "../src/liveFixtures.util.js";

const giftPrice = 10;

function sendGift(viewer: UserActor, liveId: string, giftId: string, quantity: number, idempotencyKey?: string) {
  return callApi("POST", `/api/v1/lives/${liveId}/gifts`, { token: viewer.accessToken, body: { giftId, quantity }, ...(idempotencyKey === undefined ? {} : { headers: { "idempotency-key": idempotencyKey } }) });
}

function giftsFrom(viewer: UserActor, liveId: string): number {
  return Number(psql(`select count(*) from live.processed_gifts where sender_id = '${viewer.accountId}'`)[0]?.[0] ?? 0) + 0 * liveId.length;
}

describe("going live and gifting when wallets are short and thumbs are quick", () => {
  let staff: StaffActor;
  let host: UserActor;
  let viewer: UserActor;
  let liveId = "";
  let giftId = "";
  let packageId = "";

  beforeAll(async () => {
    staff = await createSuperadmin();
    host = await withRelaxedCreatorThresholds(staff, () => registerApprovedCreator(staff, "edgehost"));
    viewer = await registerUser("edgeviewer");
    ({ giftId, packageId } = await publishGiftAndCoinPack(staff, giftPrice, 100));
    liveId = await startLive(host, "Edge gifting live");
  });

  afterAll(async () => {
    if (liveId !== "") await callApi("POST", `/api/v1/lives/${liveId}/end`, { token: host.accessToken, body: {} });
  });

  it("asks a viewer with no coins to buy some, and moves nothing", async () => {
    const before = await coinBalance(host);
    const broke = (await waitFor(async () => {
      const response = await sendGift(viewer, liveId, giftId, 1);
      if (response.body?.code === "RECIPIENT_CANNOT_RECEIVE_GIFTS") expectClearError(response, 409);
      return response.body?.code === "RECIPIENT_CANNOT_RECEIVE_GIFTS" ? undefined : response;
    }, 20_000, 1000))!;
    expectClearError(broke, 402, "INSUFFICIENT_COINS");
    expect((await coinBalance(viewer)).coins).toBe(0);
    expect((await coinBalance(host)).earnedCoins, "the host earns nothing from a failed gift").toBe(before.earnedCoins);
    expect(giftsFrom(viewer, liveId)).toBe(0);
  });

  it("charges a double-tapped gift once", async () => {
    await buyCoins(viewer, packageId, 100);
    const hostBefore = (await coinBalance(host)).earnedCoins;
    const key = `smoke-gift-tap-${Date.now()}`;
    const [first, second] = await Promise.all([sendGift(viewer, liveId, giftId, 1, key), sendGift(viewer, liveId, giftId, 1, key)]);
    expect(first.status, describeResponse(first)).toBe(201);
    expect([201, 409], describeResponse(second)).toContain(second.status);
    expect((await coinBalance(viewer)).coins, "one gift, one charge").toBe(100 - giftPrice);
    expect(giftsFrom(viewer, liveId)).toBe(1);
    const hostAfter = (await coinBalance(host)).earnedCoins;
    expect(hostAfter - hostBefore, "the host is credited once").toBeGreaterThan(0);
    expect(hostAfter - hostBefore).toBeLessThanOrEqual(giftPrice);
  });

  it("treats two quick taps with their own keys as two gifts and never goes below zero", async () => {
    const [one, two] = await Promise.all([sendGift(viewer, liveId, giftId, 1), sendGift(viewer, liveId, giftId, 1)]);
    expect([one.status, two.status], `${describeResponse(one)} / ${describeResponse(two)}`).toEqual([201, 201]);
    expect((await coinBalance(viewer)).coins).toBe(100 - 3 * giftPrice);
    const tooMany = await sendGift(viewer, liveId, giftId, 8);
    expectClearError(tooMany, 402, "INSUFFICIENT_COINS");
    expect((await coinBalance(viewer)).coins, "a refused gift leaves the balance alone").toBe(100 - 3 * giftPrice);
    const burst = await Promise.all(Array.from({ length: 10 }, () => sendGift(viewer, liveId, giftId, 1)));
    const accepted = burst.filter((response) => response.status === 201).length;
    for (const response of burst) if (response.status !== 201) expectClearError(response, [402, 429], ["INSUFFICIENT_COINS", "GIFT_RATE_LIMITED"]);
    const left = (await coinBalance(viewer)).coins;
    expect(left).toBe(100 - (3 + accepted) * giftPrice);
    expect(left).toBeGreaterThanOrEqual(0);
    expectLedgerBalancedSince(15);
  });
});
