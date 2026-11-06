import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createChannelsController, type ChannelsHandlers } from "../../src/modules/conversations/controllers/channels.controller.js";
import { registerChannelsRoutes } from "../../src/modules/conversations/routes/channels.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const accountId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const channelId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });

function channelsRouter() {
  const handlers = {
    createChannel: vi.fn(async () => ({ id: channelId, kind: "channel" })),
    subscribeToChannel: vi.fn(async () => ({ id: channelId, kind: "channel" })),
    unsubscribeFromChannel: vi.fn(async () => undefined),
  } as unknown as ChannelsHandlers;
  const router = createRouter({});
  registerChannelsRoutes(router, createChannelsController(route, handlers));
  return { router, handlers };
}

async function create(router: ReturnType<typeof createRouter>, body: unknown, signedIn = true) {
  const path = "/api/v1/channels";
  return router.dispatch(createRequestContext({
    method: "POST",
    url: path,
    path,
    headers: signedIn ? { "x-nantty-account-id": accountId } : {},
    body: JSON.stringify(body),
  }));
}

describe("channel creation route", () => {
  it("requires an authenticated owner before invoking channel creation", async () => {
    const { router, handlers } = channelsRouter();

    expect((await create(router, { name: "Maker notes" }, false)).response.status).toBe(401);
    expect(handlers.createChannel).not.toHaveBeenCalled();
  });

  it("passes only validated name, description, and optional media to the authenticated owner", async () => {
    const { router, handlers } = channelsRouter();

    expect((await create(router, { name: "Maker notes", description: "Weekly updates", photoMediaId: channelId })).response.status).toBe(201);
    expect(handlers.createChannel).toHaveBeenCalledWith({
      ownerId: accountId,
      name: "Maker notes",
      description: "Weekly updates",
      photoMediaId: channelId,
    });

    expect((await create(router, { name: "" })).response.status).toBe(400);
    expect((await create(router, { name: "x".repeat(81) })).response.status).toBe(400);
    expect((await create(router, { name: "Valid", description: "x".repeat(501) })).response.status).toBe(400);
    expect(handlers.createChannel).toHaveBeenCalledTimes(1);
  });
});
