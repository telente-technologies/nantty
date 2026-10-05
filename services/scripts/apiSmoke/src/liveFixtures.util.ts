import { expect } from "vitest";

import { registerUser, stepUpStaff, type StaffActor, type UserActor } from "./actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "./apiClient.util.js";
import { payCheckoutThroughFakePaystack } from "./fakePaystack.util.js";

export async function refreshAccessToken(actor: UserActor): Promise<UserActor> {
  const refreshed = await callApi("POST", "/api/v1/auth/refresh", { body: { refreshToken: actor.refreshToken } });
  if (refreshed.status !== 200) throw new Error(`refresh: ${describeResponse(refreshed)}`);
  return { ...actor, accessToken: refreshed.body.accessToken, refreshToken: refreshed.body.refreshToken };
}

export async function withRelaxedCreatorThresholds<T>(staff: StaffActor, work: () => Promise<T>): Promise<T> {
  const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
  expect(current.status, describeResponse(current)).toBe(200);
  const relaxedValue = { ...current.body.value, autoApprove: { ...current.body.value.autoApprove, minimumAccountAgeDays: 0, requiresVerifiedPhone: false, minimumRealFollowers: 0, minimumOriginalPostsInLast60Days: 0 }, manualReview: { ...current.body.value.manualReview, minimumRealFollowers: 0 } };
  const relaxed = await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: relaxedValue, expectedVersion: current.body.version, reason: "API smoke run needs instant creators" } });
  expect(relaxed.status, describeResponse(relaxed)).toBe(200);
  try {
    return await work();
  } finally {
    const latest = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
    await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: current.body.value, expectedVersion: latest.body.version, reason: "Restore after API smoke run" } });
  }
}

export async function registerApprovedCreator(staff: StaffActor, prefix: string): Promise<UserActor> {
  const creator = await registerUser(prefix);
  const applied = await callApi("POST", "/api/v1/users/me/creator-application", { token: creator.accessToken, body: {} });
  expect([200, 201], describeResponse(applied)).toContain(applied.status);
  const mine = await callApi("GET", "/api/v1/creators/applications/me", { token: creator.accessToken });
  if (/pending/.test(JSON.stringify(mine.body))) {
    const approved = await callApi("POST", `/api/v1/admin/applications/creators/${mine.body.id ?? mine.body.application?.id}/approve`, { token: staff.accessToken, body: { reason: "Smoke approval" } });
    expect([200, 204], describeResponse(approved)).toContain(approved.status);
  }
  return refreshAccessToken(creator);
}

export async function publishGiftAndCoinPack(staff: StaffActor, priceCoins: number, packCoins: number): Promise<{ giftId: string; packageId: string }> {
  const giftId = `smoke-gift-${uniqueSuffix()}`;
  const packageId = `smoke-pack-${uniqueSuffix()}`;
  const gift = await callApi("POST", "/api/v1/admin/gifts", { token: staff.accessToken, body: { id: giftId, name: "Smoke Star", tier: "basic", priceCoins, animationEngine: "lottie", animationAssetKey: "gifts/star.json", previewAssetKey: "gifts/star.png", durationMs: 1500, displayLevel: "micro", comboable: true, isActive: true, sortOrder: 2 } });
  expect([200, 201], describeResponse(gift)).toContain(gift.status);
  const pack = await callApi("PUT", `/api/v1/admin/coins/price-table/${packageId}`, { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { name: `Smoke ${packCoins}`, clientPlatform: "web", coins: packCoins, bonusCoins: 0, prices: { NGN: packCoins * 1000 }, active: true, sortOrder: 3 } });
  expect(pack.status, describeResponse(pack)).toBe(200);
  return { giftId, packageId };
}

export async function buyCoins(viewer: UserActor, packageId: string, expectedCoins: number): Promise<void> {
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: viewer.accessToken, body: { countryCode: "NG" } });
  const purchase = await callApi("POST", "/api/v1/coins/purchases", { token: viewer.accessToken, headers: { "x-client-region": "NG" }, body: { packageId } });
  expect([200, 201], describeResponse(purchase)).toContain(purchase.status);
  await payCheckoutThroughFakePaystack(purchase.body.reference ?? purchase.body.purchase?.reference);
  const funded = await waitFor(async () => ((await coinBalance(viewer)).coins >= expectedCoins ? true : undefined), 15_000, 500);
  expect(funded, "coins never arrived").toBe(true);
}

export async function coinBalance(actor: UserActor): Promise<{ coins: number; earnedCoins: number }> {
  const balance = await callApi("GET", "/api/v1/coins/balance", { token: actor.accessToken });
  expect(balance.status, describeResponse(balance)).toBe(200);
  return { coins: balance.body.coins ?? 0, earnedCoins: balance.body.earnedCoins ?? 0 };
}

export async function startLive(host: UserActor, title: string): Promise<string> {
  const created = await callApi("POST", "/api/v1/lives", { token: host.accessToken, body: { title, category: "justChatting", visibility: "public", startNow: true } });
  expect([200, 201], describeResponse(created)).toContain(created.status);
  return created.body.id ?? created.body.live?.id;
}
