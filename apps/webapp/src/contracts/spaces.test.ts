import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { mockSession, me, demoFanAccount } from "@/mocks/fixtures.mock";
import { spaceIdFromAnnouncement } from "@/utils/spaceAnnouncement.util";
import { readMockCoinBalance } from "@/mocks/coins.mock";
import type { Space, SpaceGrant } from "@/services/spaces.service";
const call = <T>(method: string, path: string, body?: unknown) =>
  dispatchMockApiRequest(
    method,
    path,
    new URLSearchParams(),
    body ? new TextEncoder().encode(JSON.stringify(body)) : null,
  ) as Promise<T>;
describe("Spaces flow", () => {
  it("seeds live and scheduled announcement posts and accepts a listener only once", async () => {
    mockSession.signedInUserId = demoFanAccount.id;
    const rooms = await call<Space[]>("GET", "/api/v1/spaces");
    assert.ok(rooms.some((room) => room.state === "live"));
    assert.ok(rooms.some((room) => room.state === "scheduled"));
    const live = rooms.find((room) => room.state === "live")!;
    const before = live.listenerCount;
    const grant = await call<SpaceGrant>(
      "POST",
      `/api/v1/spaces/${live.id}/join`,
    );
    assert.equal(grant.role, "listener");
    assert.equal(grant.canPublish, false);
    assert.equal(grant.demo, true);
    await call("POST", `/api/v1/spaces/${live.id}/join`);
    assert.equal(live.listenerCount, before + 1);
    const detail = await call<Space>("GET", `/api/v1/spaces/${live.id}`);
    assert.equal(detail.viewerJoined, true);
    const post = await call<{ text: string }>(
      "GET",
      `/api/v1/posts/${detail.announcementPostId}`,
    );
    assert.equal(spaceIdFromAnnouncement(post.text), live.id);
    await call("POST", `/api/v1/spaces/${live.id}/leave`);
    assert.equal(live.listenerCount, before);
    await assert.rejects(() => call("POST", `/api/v1/spaces/${live.id}/end`));
    await assert.rejects(() =>
      call("POST", "/api/v1/spaces", { title: "No host access" }),
    );
    mockSession.signedInUserId = me.id;
  });
  it("creator creates, announces, schedules, starts and ends a Space", async () => {
    mockSession.signedInUserId = me.id;
    const room = await call<Space>("POST", "/api/v1/spaces", {
      title: "Creator hour",
      giftsEnabled: false,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    assert.equal(room.state, "scheduled");
    assert.equal(room.giftsEnabled, false);
    await call("PATCH", `/api/v1/spaces/${room.id}/coin-donations`, { enabled: true });
    assert.equal((await call<Space>("GET", `/api/v1/spaces/${room.id}`)).giftsEnabled, true);
    await assert.rejects(() => call("POST", `/api/v1/spaces/${room.id}/join`));
    const post = await call<{ id: string }>("POST", "/api/v1/posts", {
      text: `Join my Space: ${room.title}\nhttps://web.nantty.com/spaces/${room.id}`,
      audience: "everyone",
      mediaIds: [],
    });
    const wrongPost = await call<{ id: string }>("POST", "/api/v1/posts", {
      text: "An unrelated post",
      audience: "everyone",
      mediaIds: [],
    });
    await assert.rejects(() =>
      call("POST", `/api/v1/spaces/${room.id}/announcement`, {
        postId: wrongPost.id,
      }),
    );
    await call("POST", `/api/v1/spaces/${room.id}/announcement`, {
      postId: post.id,
    });
    await call("POST", `/api/v1/spaces/${room.id}/announcement`, {
      postId: post.id,
    });
    await assert.rejects(() =>
      call("POST", `/api/v1/spaces/${room.id}/announcement`, {
        postId: wrongPost.id,
      }),
    );
    assert.equal(
      (await call<Space>("GET", `/api/v1/spaces/${room.id}`))
        .announcementPostId,
      post.id,
    );
    await call("POST", `/api/v1/spaces/${room.id}/start`);
    const grant = await call<SpaceGrant>(
      "POST",
      `/api/v1/spaces/${room.id}/join`,
    );
    assert.equal(grant.role, "host");
    mockSession.signedInUserId = demoFanAccount.id;
    const senderBalanceBefore = readMockCoinBalance();
    const donation = await call<{ totalCoins: number; senderCoinBalance: number }>("POST", `/api/v1/spaces/${room.id}/coin-donations`, { coins: 125 });
    assert.equal(donation.totalCoins, 125);
    assert.equal(donation.senderCoinBalance, senderBalanceBefore - 125);
    mockSession.signedInUserId = me.id;
    await call("POST", `/api/v1/spaces/${room.id}/end`);
    await assert.rejects(() => call("POST", `/api/v1/spaces/${room.id}/start`));
    await assert.rejects(() =>
      call("POST", "/api/v1/spaces", {
        title: "Past",
        scheduledAt: "2000-01-01T00:00:00Z",
      }),
    );
  });
  it("keeps announcement destinations internal and rejects malformed IDs", () => {
    assert.equal(spaceIdFromAnnouncement("regular post"), null);
    assert.equal(
      spaceIdFromAnnouncement(
        "Join my Space: Test\nhttps://web.nantty.com/spaces/abc#comments",
      ),
      "abc",
    );
    assert.equal(
      spaceIdFromAnnouncement(
        "Join my Space: Test\nhttps://web.nantty.com/spaces/a%2Fb",
      ),
      null,
    );
  });
});
