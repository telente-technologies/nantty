import { describe, expect, it } from "vitest";

import { createAcceptPendingFollowRequestsHandler } from "../../src/modules/follows/commands/acceptPendingFollowRequests/acceptPendingFollowRequests.handler.js";
import { createFollowUserHandler } from "../../src/modules/follows/commands/followUser/followUser.handler.js";
import { createRespondToFollowRequestHandler } from "../../src/modules/follows/commands/respondToFollowRequest/respondToFollowRequest.handler.js";
import { createUnfollowUserHandler } from "../../src/modules/follows/commands/unfollowUser/unfollowUser.handler.js";
import { createGetFollowStatusHandler } from "../../src/modules/follows/queries/getFollowStatus/getFollowStatus.handler.js";
import { createListFollowRequestsHandler } from "../../src/modules/follows/queries/listFollowRequests/listFollowRequests.handler.js";
import { followCancelCooldownMs, followDeclineCooldownMs } from "../../src/modules/follows/services/followRules.service.js";
import { createContentEventRouter } from "../../src/modules/contentEvents/services/contentEventRouter.service.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";

const ownerId = "0192f0a0-0000-7000-8000-00000000a001";
const requesterId = "0192f0a0-0000-7000-8000-00000000b001";
const strangerId = "0192f0a0-0000-7000-8000-00000000c001";

function setup() {
  const store = createMemoryStore();
  store.privateAccountIds.add(ownerId);
  const context = store.context;
  const follow = createFollowUserHandler(context);
  const unfollow = createUnfollowUserHandler(context);
  const respond = createRespondToFollowRequestHandler(context);
  const status = () => createGetFollowStatusHandler(context)({ viewerId: requesterId, targetId: ownerId }).then((view) => view.state);
  const pendingRequestId = async () => (await createListFollowRequestsHandler(context)({ followeeId: ownerId, cursor: undefined, limit: 20 })).data[0]?.id as string;
  const eventsOfType = (type: string) => store.events.filter((event) => event["eventType"] === type) as Row[];
  const advance = (milliseconds: number) => { store.now = new Date(store.now.getTime() + milliseconds); };
  return { store, follow, unfollow, respond, status, pendingRequestId, eventsOfType, advance };
}

describe("following a private account", () => {
  it("turns a double tap into a single pending request and a single notification", async () => {
    const world = setup();
    const [first, second] = await Promise.all([world.follow({ followerId: requesterId, targetId: ownerId }), world.follow({ followerId: requesterId, targetId: ownerId })]);
    expect(first.state).toBe("requested");
    expect(second.state).toBe("requested");
    expect(await world.follow({ followerId: requesterId, targetId: ownerId })).toEqual({ state: "requested" });
    expect(world.store.follows).toHaveLength(1);
    expect(world.eventsOfType("followRequest.created")).toHaveLength(1);
    expect(await world.status()).toBe("requested");
  });

  it("follows a public account straight away", async () => {
    const world = setup();
    world.store.privateAccountIds.clear();
    expect(await world.follow({ followerId: requesterId, targetId: ownerId })).toEqual({ state: "accepted" });
    expect(world.eventsOfType("followRequest.created")).toHaveLength(0);
    expect(world.eventsOfType("follow.created")).toHaveLength(1);
  });

  it("lets the requester cancel, then holds re-requests for a short cooldown", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    const requestId = await world.pendingRequestId();
    await world.unfollow({ followerId: requesterId, targetId: ownerId });
    expect(await world.status()).toBe("rejected");
    expect(await world.pendingRequestId()).toBeUndefined();
    await expect(world.respond({ followeeId: ownerId, requestId, decision: "accept" })).rejects.toMatchObject({ status: 409 });
    await expect(world.follow({ followerId: requesterId, targetId: ownerId })).rejects.toMatchObject({ status: 429, code: "FOLLOW_REQUEST_COOLDOWN" });
    world.advance(followCancelCooldownMs + 1000);
    expect(await world.follow({ followerId: requesterId, targetId: ownerId })).toEqual({ state: "requested" });
    expect(world.eventsOfType("followRequest.created")).toHaveLength(2);
  });

  it("accepts once even when the owner taps Confirm twice, and tells the requester", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    const requestId = await world.pendingRequestId();
    await world.respond({ followeeId: ownerId, requestId, decision: "accept" });
    await world.respond({ followeeId: ownerId, requestId, decision: "accept" });
    expect(await world.status()).toBe("accepted");
    expect(world.eventsOfType("follow.created")).toHaveLength(1);
    expect(world.eventsOfType("follow.created")[0]?.["payload"]).toMatchObject({ data: { viaRequest: true, recipientUserId: ownerId } });
    const accepted = world.eventsOfType("followRequest.accepted");
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.["payload"]).toMatchObject({ data: { recipientUserId: requesterId, followerId: requesterId, followeeId: ownerId, actor: { id: ownerId }, url: `/user/${ownerId}` } });
    await expect(world.respond({ followeeId: ownerId, requestId, decision: "reject" })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to let anyone but the private owner answer the request", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    const requestId = await world.pendingRequestId();
    await expect(world.respond({ followeeId: strangerId, requestId, decision: "accept" })).rejects.toMatchObject({ status: 403 });
    await expect(world.respond({ followeeId: requesterId, requestId, decision: "accept" })).rejects.toMatchObject({ status: 403 });
    await expect(world.respond({ followeeId: ownerId, requestId: "0192f0a0-0000-7000-8000-0000000000ff", decision: "accept" })).rejects.toMatchObject({ status: 404 });
    expect(await world.status()).toBe("requested");
  });

  it("declines quietly, puts the button back to Follow and allows a new request after the cooldown", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    const requestId = await world.pendingRequestId();
    await world.respond({ followeeId: ownerId, requestId, decision: "reject" });
    await world.respond({ followeeId: ownerId, requestId, decision: "reject" });
    expect(await world.status()).toBe("rejected");
    expect(world.eventsOfType("follow.rejected")).toHaveLength(1);
    expect(world.eventsOfType("followRequest.accepted")).toHaveLength(0);
    await expect(world.follow({ followerId: requesterId, targetId: ownerId })).rejects.toMatchObject({ status: 429 });
    world.advance(followDeclineCooldownMs - 60_000);
    await expect(world.follow({ followerId: requesterId, targetId: ownerId })).rejects.toMatchObject({ status: 429 });
    world.advance(120_000);
    expect(await world.follow({ followerId: requesterId, targetId: ownerId })).toEqual({ state: "requested" });
  });

  it("lets a block in either direction beat a pending acceptance", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    const requestId = await world.pendingRequestId();
    world.store.blocks.push({ blockerId: requesterId, blockedId: ownerId });
    await expect(world.respond({ followeeId: ownerId, requestId, decision: "accept" })).rejects.toMatchObject({ status: 409 });
    expect(world.eventsOfType("followRequest.accepted")).toHaveLength(0);
    await expect(world.follow({ followerId: requesterId, targetId: ownerId })).rejects.toMatchObject({ status: 403 });
  });
});

describe("switching a private account to public", () => {
  it("auto-accepts every pending request without notifying anyone again", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    await world.follow({ followerId: strangerId, targetId: ownerId });
    world.store.privateAccountIds.clear();
    const route = createContentEventRouter({
      applyContentVisibility: async () => true,
      applyProcessedMedia: async () => undefined,
      acceptPendingFollowRequests: createAcceptPendingFollowRequestsHandler(world.store.context),
    });
    await route(JSON.stringify({ type: "profile.visibilityChanged", data: { accountId: ownerId, profileId: ownerId, isPrivate: false } }));
    expect(world.store.follows.map((row) => row["state"])).toEqual(["accepted", "accepted"]);
    expect(await world.status()).toBe("accepted");
    expect(world.eventsOfType("follow.created")).toHaveLength(2);
    expect(world.eventsOfType("follow.created").every((event) => (event["payload"] as { data: { viaRequest?: boolean } }).data.viaRequest === true)).toBe(true);
    expect(world.eventsOfType("followRequest.accepted")).toHaveLength(0);
  });

  it("leaves requests alone when the account went private again before the event arrived", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    expect(await createAcceptPendingFollowRequestsHandler(world.store.context)({ accountId: ownerId })).toBe(0);
    expect(await world.status()).toBe("requested");
  });

  it("does nothing when an account becomes private", async () => {
    const world = setup();
    await world.follow({ followerId: requesterId, targetId: ownerId });
    let called = false;
    const route = createContentEventRouter({ applyContentVisibility: async () => true, applyProcessedMedia: async () => undefined, acceptPendingFollowRequests: async () => { called = true; } });
    await route(JSON.stringify({ type: "profile.visibilityChanged", data: { accountId: ownerId, isPrivate: true } }));
    expect(called).toBe(false);
  });
});
