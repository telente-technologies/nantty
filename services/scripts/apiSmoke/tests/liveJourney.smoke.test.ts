import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, registerUser, stepUpStaff, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { payCheckoutThroughFakePaystack } from "../src/fakePaystack.util.js";
import { connectRealtimeClient, type RealtimeClient } from "../src/realtimeClient.util.js";

async function refreshAccessToken(actor: UserActor): Promise<UserActor> {
  const refreshed = await callApi("POST", "/api/v1/auth/refresh", { body: { refreshToken: actor.refreshToken } });
  if (refreshed.status !== 200) throw new Error(`refresh: ${describeResponse(refreshed)}`);
  return { ...actor, accessToken: refreshed.body.accessToken, refreshToken: refreshed.body.refreshToken };
}

function findSlotIdForUser(node: unknown, userId: string): string | undefined {
  if (Array.isArray(node)) return node.map((child) => findSlotIdForUser(child, userId)).find((found) => found !== undefined);
  if (typeof node !== "object" || node === null) return undefined;
  const record = node as Record<string, unknown>;
  if (typeof record["slotId"] === "string" && JSON.stringify(record).includes(userId)) return record["slotId"];
  if (typeof record["id"] === "string" && typeof record["liveId"] === "string" && JSON.stringify(record).includes(userId)) return record["id"];
  return Object.values(record).map((child) => findSlotIdForUser(child, userId)).find((found) => found !== undefined);
}

describe("live journey: creator approval → live start → coins → gift with realtime fan-out → battle → settlement", () => {
  let staff: StaffActor;
  let host: UserActor;
  let rival: UserActor;
  let viewer: UserActor;
  let originalRequirements: { value: unknown; version: number } | undefined;
  let liveId = "";
  let rivalLiveId = "";
  let realtime: RealtimeClient | undefined;
  const giftId = `smoke-rose-${uniqueSuffix()}`;
  const packageId = `smoke-pack-${uniqueSuffix()}`;

  beforeAll(async () => {
    staff = await createSuperadmin();
    host = await registerUser("host");
    rival = await registerUser("rival");
    viewer = await registerUser("viewer");
  });

  afterAll(async () => {
    realtime?.close();
    if (originalRequirements !== undefined) {
      const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
      await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: originalRequirements.value, expectedVersion: current.body.version, reason: "Restore after API smoke run" } });
    }
  });

  it("lets staff relax creator requirements and approves both creators", async () => {
    const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
    expect(current.status, describeResponse(current)).toBe(200);
    originalRequirements = { value: current.body.value, version: current.body.version };
    const relaxed = await callApi("PUT", "/api/v1/admin/config/creator-thresholds", {
      token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) },
      body: { value: { ...current.body.value, autoApprove: { ...current.body.value.autoApprove, minimumAccountAgeDays: 0, requiresVerifiedPhone: false, minimumRealFollowers: 0, minimumOriginalPostsInLast60Days: 0 }, manualReview: { ...current.body.value.manualReview, minimumRealFollowers: 0 } }, expectedVersion: current.body.version, reason: "API smoke run needs instant creators" },
    });
    expect(relaxed.status, describeResponse(relaxed)).toBe(200);
    for (const creator of [host, rival]) {
      const applied = await callApi("POST", "/api/v1/users/me/creator-application", { token: creator.accessToken, body: {} });
      expect([200, 201], describeResponse(applied)).toContain(applied.status);
      const mine = await callApi("GET", "/api/v1/creators/applications/me", { token: creator.accessToken });
      if (/pending/.test(JSON.stringify(mine.body))) {
        const approved = await callApi("POST", `/api/v1/admin/applications/creators/${mine.body.id ?? mine.body.application?.id}/approve`, { token: staff.accessToken, body: { reason: "Smoke approval" } });
        expect([200, 204], describeResponse(approved)).toContain(approved.status);
      }
    }
    host = await refreshAccessToken(host);
    rival = await refreshAccessToken(rival);
    const roles = JSON.parse(Buffer.from(host.accessToken.split(".")[1] ?? "", "base64url").toString()).roles as string[];
    expect(roles).toContain("creator");
  });

  it("lets staff publish a gift and a coin package", async () => {
    const gift = await callApi("POST", "/api/v1/admin/gifts", { token: staff.accessToken, body: { id: giftId, name: "Smoke Rose", tier: "basic", priceCoins: 10, animationEngine: "lottie", animationAssetKey: "gifts/rose.json", previewAssetKey: "gifts/rose.png", durationMs: 1500, displayLevel: "micro", comboable: true, isActive: true, sortOrder: 1 } });
    expect([200, 201], describeResponse(gift)).toContain(gift.status);
    const pack = await callApi("PUT", `/api/v1/admin/coins/price-table/${packageId}`, { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { name: "Smoke 100", clientPlatform: "web", coins: 100, bonusCoins: 0, prices: { NGN: 100_000 }, active: true, sortOrder: 1 } });
    expect(pack.status, describeResponse(pack)).toBe(200);
    const catalog = await callApi("GET", "/api/v1/gifts", { token: viewer.accessToken });
    expect(JSON.stringify(catalog.body), describeResponse(catalog)).toContain(giftId);
  });

  it("starts a live session and lets a viewer join with a realtime subscription", async () => {
    const created = await callApi("POST", "/api/v1/lives", { token: host.accessToken, body: { title: "Smoke live", category: "justChatting", visibility: "public", startNow: true } });
    expect([200, 201], describeResponse(created)).toContain(created.status);
    liveId = created.body.id ?? created.body.live?.id;
    const joined = await callApi("POST", `/api/v1/lives/${liveId}/join`, { token: viewer.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(joined)).toContain(joined.status);
    realtime = await connectRealtimeClient(viewer.accessToken);
    await realtime.subscribe(`live:${liveId}`);
    const viewerRead = await callApi("GET", `/api/v1/lives/${liveId}`, { token: viewer.accessToken });
    expect(viewerRead.status, describeResponse(viewerRead)).toBe(200);
  });

  it("fans a live comment out over the realtime socket", async () => {
    const sentAt = performance.now();
    const comment = await callApi("POST", `/api/v1/lives/${liveId}/comments`, { token: viewer.accessToken, body: { text: "Smoke hello" } });
    expect([200, 201], describeResponse(comment)).toContain(comment.status);
    const frame = await realtime?.waitForFrame((candidate) => candidate.type === "live.comment", 10_000);
    expect(frame, "live.comment never reached the socket").toBeDefined();
    expect((frame?.receivedAt ?? sentAt) - sentAt).toBeLessThan(5_000);
  });

  it("buys coins through the provider fake", async () => {
    const country = await callApi("PATCH", "/api/v1/users/me/preferences", { token: viewer.accessToken, body: { countryCode: "NG" } });
    expect([200, 204], describeResponse(country)).toContain(country.status);
    const purchase = await callApi("POST", "/api/v1/coins/purchases", { token: viewer.accessToken, headers: { "x-client-region": "NG" }, body: { packageId } });
    expect([200, 201], describeResponse(purchase)).toContain(purchase.status);
    const reference = purchase.body.reference ?? purchase.body.purchase?.reference;
    await payCheckoutThroughFakePaystack(reference);
    const funded = await waitFor(async () => {
      const balance = await callApi("GET", "/api/v1/coins/balance", { token: viewer.accessToken });
      return balance.body?.coins >= 100 ? balance : undefined;
    }, 15_000, 500);
    expect(funded, "coins never reached the viewer's balance").toBeDefined();
  });

  it("sends a gift and fans gift.sent out over the realtime socket", async () => {
    const sentAt = performance.now();
    const gift = await callApi("POST", `/api/v1/lives/${liveId}/gifts`, { token: viewer.accessToken, body: { giftId, quantity: 1, receiverUserId: host.accountId } });
    expect([200, 201], describeResponse(gift)).toContain(gift.status);
    const frame = await realtime?.waitForFrame((candidate) => candidate.type === "gift.sent", 10_000);
    expect(frame, "gift.sent never reached the socket").toBeDefined();
    expect((frame?.receivedAt ?? sentAt) - sentAt).toBeLessThan(5_000);
  });

  it("runs a battle between two creators and settles it", async () => {
    const rivalLive = await callApi("POST", "/api/v1/lives", { token: rival.accessToken, body: { title: "Smoke rival", category: "justChatting", visibility: "public", startNow: true } });
    expect([200, 201], describeResponse(rivalLive)).toContain(rivalLive.status);
    rivalLiveId = rivalLive.body.id ?? rivalLive.body.live?.id;
    const invited = await callApi("POST", `/api/v1/lives/${liveId}/guests/invitations`, { token: host.accessToken, body: { userId: rival.accountId } });
    expect([200, 201], describeResponse(invited)).toContain(invited.status);
    const slotId = findSlotIdForUser(invited.body, rival.accountId);
    const joinedStage = await callApi("POST", `/api/v1/lives/${liveId}/guests/invitations/${slotId}/accept`, { token: rival.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(joinedStage)).toContain(joinedStage.status);
    const connected = await callApi("POST", `/api/v1/lives/${liveId}/guests/me/connection`, { token: rival.accessToken, body: { connected: true } });
    expect([200, 201, 204], describeResponse(connected)).toContain(connected.status);
    const battle = await callApi("POST", `/api/v1/lives/${liveId}/battles`, { token: host.accessToken, body: { participantUserIds: [host.accountId, rival.accountId], durationSeconds: 60, winnerTakesAll: false } });
    expect([200, 201], describeResponse(battle)).toContain(battle.status);
    const battleId: string = battle.body.battle?.id ?? battle.body.activeBattle?.id ?? battle.body.battleId ?? battle.body.id;
    if (/pending/i.test(String(battle.body.activeBattle?.status ?? battle.body.battle?.status ?? ""))) {
      const accepted = await callApi("POST", `/api/v1/battles/${battleId}/accept`, { token: rival.accessToken, body: {} });
      expect([200, 201, 410], describeResponse(accepted)).toContain(accepted.status);
    }
    const active = await waitFor(async () => {
      const stage = await callApi("GET", `/api/v1/lives/${liveId}/stage`, { token: host.accessToken });
      return stage.body?.activeBattle?.status === "active" || stage.body?.activeBattle?.state === "active" ? stage : undefined;
    }, 20_000, 500);
    expect(active, "battle never became active").toBeDefined();
    const ended = await callApi("POST", `/api/v1/battles/${battleId}/end`, { token: host.accessToken, body: {} });
    expect([200, 201], describeResponse(ended)).toContain(ended.status);
    const settled = await waitFor(async () => {
      const stage = await callApi("GET", `/api/v1/lives/${liveId}/stage`, { token: host.accessToken });
      return /settled|ended|completed/i.test(JSON.stringify(stage.body)) ? stage : undefined;
    }, 15_000, 500);
    expect(settled, "battle never settled").toBeDefined();
  });

  it("ends both live sessions", async () => {
    for (const [actor, id] of [[host, liveId], [rival, rivalLiveId]] as const) {
      if (id === "") continue;
      const ended = await callApi("POST", `/api/v1/lives/${id}/end`, { token: actor.accessToken, body: {} });
      expect([200, 201, 204], describeResponse(ended)).toContain(ended.status);
    }
  });
});
