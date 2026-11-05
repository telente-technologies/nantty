import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createStoreFollowsController, type StoreFollowsHandlers } from "../../src/modules/storeFollows/controllers/storeFollows.controller.js";
import { registerStoreFollowsRoutes } from "../../src/modules/storeFollows/routes/storeFollows.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });
const accountId = "0192f0a0-0000-7000-8000-00000000a001";
const storeId = "0192f0a0-0000-7000-8000-00000000b001";

function storeFollowsRouter() {
  const followStore = vi.fn(async () => ({ storeId, isFollowing: true, followers: 12 }));
  const unfollowStore = vi.fn(async () => ({ storeId, isFollowing: false, followers: 11 }));
  const handlers = {
    followStore,
    unfollowStore,
    listStoreFollowers: vi.fn(async () => ({ data: [], nextCursor: null })),
    getStoreFollowStatus: vi.fn(async () => ({ storeId, isFollowing: false, followers: 11 })),
  } as unknown as StoreFollowsHandlers;
  const router = createRouter({});
  registerStoreFollowsRoutes(router, createStoreFollowsController(route, handlers, "internal-token"));
  return { router, followStore, unfollowStore };
}

async function dispatch(router: ReturnType<typeof createRouter>, method: string, signedIn = true, storePath = storeId) {
  const path = `/api/v1/stores/${storePath}/follow`;
  const { response } = await router.dispatch(createRequestContext({
    method: method as never,
    url: path,
    path,
    headers: signedIn ? { "x-nantty-account-id": accountId } : {},
  }));
  return response;
}

async function dispatchInternal(router: ReturnType<typeof createRouter>, method: string, validToken: boolean, storePath = storeId, followerPath = accountId) {
  const path = `/api/v1/internal/stores/${storePath}/followers/${followerPath}`;
  const { response } = await router.dispatch(createRequestContext({
    method: method as never,
    url: path,
    path,
    headers: validToken ? { "x-internal-token": "internal-token" } : {},
  }));
  return response;
}

describe("store follow routes", () => {
  it("requires a gateway-authenticated account and maps follow/unfollow to the account and store IDs", async () => {
    const { router, followStore, unfollowStore } = storeFollowsRouter();

    expect((await dispatch(router, "POST", false)).status).toBe(401);
    expect((await dispatch(router, "DELETE", false)).status).toBe(401);
    expect(followStore).not.toHaveBeenCalled();
    expect(unfollowStore).not.toHaveBeenCalled();

    const followed = await dispatch(router, "POST");
    expect(followed.status).toBe(200);
    expect(followed.body).toEqual({ storeId, isFollowing: true, followers: 12 });
    expect(followStore).toHaveBeenCalledWith({ followerId: accountId, storeId });

    const unfollowed = await dispatch(router, "DELETE");
    expect(unfollowed.status).toBe(200);
    expect(unfollowed.body).toEqual({ storeId, isFollowing: false, followers: 11 });
    expect(unfollowStore).toHaveBeenCalledWith({ followerId: accountId, storeId });
  });

  it("rejects malformed store IDs before invoking the follow handler", async () => {
    const { router, followStore } = storeFollowsRouter();

    expect((await dispatch(router, "POST", true, "not-a-uuid")).status).toBe(400);
    expect(followStore).not.toHaveBeenCalled();
  });

  it("allows only internal callers to map validated actor and store IDs to follow mutations", async () => {
    const { router, followStore, unfollowStore } = storeFollowsRouter();

    expect((await dispatchInternal(router, "POST", false)).status).toBe(401);
    expect(followStore).not.toHaveBeenCalled();

    const followed = await dispatchInternal(router, "POST", true);
    expect(followed.status).toBe(200);
    expect(followed.body).toEqual({ storeId, isFollowing: true, followers: 12 });
    expect(followStore).toHaveBeenCalledWith({ followerId: accountId, storeId });

    const unfollowed = await dispatchInternal(router, "DELETE", true);
    expect(unfollowed.status).toBe(200);
    expect(unfollowed.body).toEqual({ storeId, isFollowing: false, followers: 11 });
    expect(unfollowStore).toHaveBeenCalledWith({ followerId: accountId, storeId });

    expect((await dispatchInternal(router, "POST", true, "not-a-uuid")).status).toBe(400);
  });
});
