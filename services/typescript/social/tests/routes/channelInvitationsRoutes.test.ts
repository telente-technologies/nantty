import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";
import { createChannelInvitationsController, type ChannelInvitationsHandlers } from "../../src/modules/channelInvitations/controllers/channelInvitations.controller.js";
import { registerChannelInvitationsRoutes } from "../../src/modules/channelInvitations/routes/channelInvitations.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const accountId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const channelId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const invitationId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const linkId = "01a12b3d-d5cc-7e11-bc61-000000000004";
const token = "t".repeat(43);
const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });

function setup() {
  const handlers: ChannelInvitationsHandlers = {
    createLink: vi.fn(async (command) => ({ id: linkId, channelId, token, expiresAt: new Date().toISOString(), ...command } as never)),
    previewLink: vi.fn(async () => ({ channel: { title: "Updates", subscriberCount: 3 }, expiresAt: new Date().toISOString() })),
    claimLink: vi.fn(async () => ({ id: invitationId, status: "pending" } as never)),
    accept: vi.fn(async () => ({ id: invitationId, status: "accepted" } as never)),
    decline: vi.fn(async () => ({ id: invitationId, status: "declined" } as never)),
    revokeLink: vi.fn(async () => ({ id: linkId, channelId, revokedAt: new Date().toISOString() } as never)),
    listLinks: vi.fn(async () => ({ data: [], nextCursor: null })),
    listInvitations: vi.fn(async () => ({ data: [], nextCursor: null })),
  };
  const router = createRouter({});
  registerChannelInvitationsRoutes(router, createChannelInvitationsController(route, handlers));
  return { router, handlers };
}

async function dispatch(router: ReturnType<typeof createRouter>, method: string, path: string, body?: unknown, signedIn = true) {
  return router.dispatch(createRequestContext({
    method: method as never,
    url: path,
    path,
    headers: signedIn ? { "x-nantty-account-id": accountId } : {},
    ...(body === undefined ? {} : { body }),
  }));
}

describe("channel invitation-link routes", () => {
  it("requires authentication and maps the signed-in account to invitation actions", async () => {
    const { router, handlers } = setup();
    const unauthenticated = await Promise.all([
      dispatch(router, "POST", `/api/v1/channels/${channelId}/invitation-links`, {}, false),
      dispatch(router, "GET", `/api/v1/channels/${channelId}/invitation-links`, undefined, false),
      dispatch(router, "GET", `/api/v1/channels/invitation-links/${token}/preview`, undefined, false),
      dispatch(router, "POST", `/api/v1/channels/invitation-links/${token}/claim`, undefined, false),
      dispatch(router, "GET", "/api/v1/channel-invitations", undefined, false),
      dispatch(router, "POST", `/api/v1/channel-invitations/${invitationId}/accept`, undefined, false),
      dispatch(router, "POST", `/api/v1/channel-invitations/${invitationId}/decline`, undefined, false),
      dispatch(router, "DELETE", `/api/v1/channels/${channelId}/invitation-links/${linkId}`, undefined, false),
    ]);
    expect(unauthenticated.map((result) => result.response.status)).toEqual(Array(8).fill(401));
    expect(handlers.claimLink).not.toHaveBeenCalled();
    expect(handlers.accept).not.toHaveBeenCalled();

    expect((await dispatch(router, "POST", `/api/v1/channels/${channelId}/invitation-links`, { expiresInHours: 24 })).response.status).toBe(201);
    expect(handlers.createLink).toHaveBeenCalledWith({ actorId: accountId, channelId, expiresInHours: 24 });
    await dispatch(router, "GET", `/api/v1/channels/invitation-links/${token}/preview`);
    await dispatch(router, "POST", `/api/v1/channels/invitation-links/${token}/claim`);
    expect(handlers.previewLink).toHaveBeenCalledWith({ token });
    expect(handlers.claimLink).toHaveBeenCalledWith({ inviteeId: accountId, token });
    await dispatch(router, "POST", `/api/v1/channel-invitations/${invitationId}/accept`);
    await dispatch(router, "POST", `/api/v1/channel-invitations/${invitationId}/decline`);
    expect(handlers.accept).toHaveBeenCalledWith({ inviteeId: accountId, invitationId });
    expect(handlers.decline).toHaveBeenCalledWith({ inviteeId: accountId, invitationId });
  });

  it("validates UUIDs, expiry choices, tokens, and paging inputs", async () => {
    const { router, handlers } = setup();
    expect((await dispatch(router, "POST", "/api/v1/channels/not-a-uuid/invitation-links", {})).response.status).toBe(400);
    expect((await dispatch(router, "POST", `/api/v1/channels/${channelId}/invitation-links`, { expiresInHours: 999 })).response.status).toBe(400);
    expect((await dispatch(router, "GET", "/api/v1/channels/invitation-links/invalid/preview")).response.status).toBe(400);
    expect((await dispatch(router, "GET", `/api/v1/channels/${channelId}/invitation-links?limit=101`)).response.status).toBe(400);
    expect((await dispatch(router, "GET", "/api/v1/channel-invitations?status=unknown")).response.status).toBe(400);
    expect(handlers.createLink).not.toHaveBeenCalled();
    expect(handlers.previewLink).not.toHaveBeenCalled();
    expect(handlers.listLinks).not.toHaveBeenCalled();
    expect(handlers.listInvitations).not.toHaveBeenCalled();
  });

  it("maps link management and pending invitation listing with safe default pagination", async () => {
    const { router, handlers } = setup();
    await dispatch(router, "GET", `/api/v1/channels/${channelId}/invitation-links?limit=5&cursor=${linkId}`);
    expect(handlers.listLinks).toHaveBeenCalledWith({ actorId: accountId, channelId, cursor: linkId, limit: 5 });
    await dispatch(router, "DELETE", `/api/v1/channels/${channelId}/invitation-links/${linkId}`);
    expect(handlers.revokeLink).toHaveBeenCalledWith({ actorId: accountId, channelId, linkId });
    await dispatch(router, "GET", "/api/v1/channel-invitations");
    expect(handlers.listInvitations).toHaveBeenCalledWith({ inviteeId: accountId, status: "pending", cursor: undefined, limit: 20 });
  });
});
