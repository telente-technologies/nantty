import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createGroupInvitationsController, type GroupInvitationHandlers } from "../../src/modules/groupInvitations/controllers/groupInvitations.controller.js";
import { registerGroupInvitationsRoutes } from "../../src/modules/groupInvitations/routes/groupInvitations.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const accountId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const conversationId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const inviteeId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const invitationId = "01a12b3d-d5cc-7e11-bc61-000000000004";
const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });

function buildRouter() {
  const handlers: GroupInvitationHandlers = {
    create: vi.fn(async (command) => ({ id: invitationId, ...command } as never)),
    list: vi.fn(async (query) => ({ data: [], nextCursor: null, ...query } as never)),
    respond: vi.fn(async (command) => ({ id: command.invitationId, ...command } as never)),
    revoke: vi.fn(async (command) => ({ id: command.invitationId, ...command } as never)),
    createLink: vi.fn(async (command) => ({ id: invitationId, token: "t".repeat(43), ...command } as never)),
    previewLink: vi.fn(async () => ({ group: { title: "Group", memberCount: 2 }, expiresAt: new Date().toISOString() } as never)),
    claimLink: vi.fn(async () => ({ id: invitationId, status: "pending" } as never)),
    revokeLink: vi.fn(async (command) => ({ id: command.linkId, ...command } as never)),
    listLinks: vi.fn(async () => ({ data: [], nextCursor: null } as never)),
  };
  const router = createRouter({});
  registerGroupInvitationsRoutes(router, createGroupInvitationsController(route, handlers));
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

describe("group invitation routes", () => {
  it("requires authentication for create, list, accept, decline, and revoke", async () => {
    const { router, handlers } = buildRouter();
    const outcomes = await Promise.all([
      dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitations`, { inviteeId }, false),
      dispatch(router, "GET", "/api/v1/group-invitations", undefined, false),
      dispatch(router, "POST", `/api/v1/group-invitations/${invitationId}/accept`, undefined, false),
      dispatch(router, "POST", `/api/v1/group-invitations/${invitationId}/decline`, undefined, false),
      dispatch(router, "DELETE", `/api/v1/conversations/${conversationId}/invitations/${invitationId}`, undefined, false),
      dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitation-links`, {}, false),
      dispatch(router, "GET", `/api/v1/conversations/invitation-links/${"t".repeat(43)}/preview`, undefined, false),
      dispatch(router, "POST", `/api/v1/conversations/invitation-links/${"t".repeat(43)}/claim`, undefined, false),
      dispatch(router, "DELETE", `/api/v1/conversations/${conversationId}/invitation-links/${invitationId}`, undefined, false),
      dispatch(router, "GET", `/api/v1/conversations/${conversationId}/invitation-links`, undefined, false),
    ]);
    expect(outcomes.map((item) => item.response.status)).toEqual([401, 401, 401, 401, 401, 401, 401, 401, 401, 401]);
    expect(handlers.create).not.toHaveBeenCalled();
    expect(handlers.list).not.toHaveBeenCalled();
    expect(handlers.respond).not.toHaveBeenCalled();
    expect(handlers.revoke).not.toHaveBeenCalled();
    expect(handlers.createLink).not.toHaveBeenCalled();
    expect(handlers.previewLink).not.toHaveBeenCalled();
    expect(handlers.claimLink).not.toHaveBeenCalled();
    expect(handlers.revokeLink).not.toHaveBeenCalled();
    expect(handlers.listLinks).not.toHaveBeenCalled();
  });

  it("validates IDs, invitee, direction, and bounded page size", async () => {
    const { router, handlers } = buildRouter();
    expect((await dispatch(router, "POST", "/api/v1/conversations/not-a-uuid/invitations", { inviteeId })).response.status).toBe(400);
    expect((await dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitations`, { inviteeId: "invalid" })).response.status).toBe(400);
    expect((await dispatch(router, "GET", "/api/v1/group-invitations?direction=other&limit=1000")).response.status).toBe(400);
    expect(handlers.create).not.toHaveBeenCalled();
    expect(handlers.list).not.toHaveBeenCalled();
  });

  it("maps authenticated command actors and defaults the invitation inbox to received", async () => {
    const { router, handlers } = buildRouter();
    expect((await dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitations`, { inviteeId })).response.status).toBe(201);
    expect(handlers.create).toHaveBeenCalledWith({ actorId: accountId, conversationId, inviteeId });
    expect((await dispatch(router, "GET", "/api/v1/group-invitations?limit=25")).response.status).toBe(200);
    expect(handlers.list).toHaveBeenCalledWith({ accountId, direction: "received", status: "pending", cursor: undefined, limit: 25 });
    await dispatch(router, "GET", "/api/v1/group-invitations?direction=sent&status=accepted");
    expect(handlers.list).toHaveBeenCalledWith({ accountId, direction: "sent", status: "accepted", cursor: undefined, limit: 20 });
    await dispatch(router, "POST", `/api/v1/group-invitations/${invitationId}/accept`);
    expect(handlers.respond).toHaveBeenCalledWith({ accountId, invitationId, decision: "accept" });
    await dispatch(router, "POST", `/api/v1/group-invitations/${invitationId}/decline`);
    expect(handlers.respond).toHaveBeenCalledWith({ accountId, invitationId, decision: "decline" });
    await dispatch(router, "DELETE", `/api/v1/conversations/${conversationId}/invitations/${invitationId}`);
    expect(handlers.revoke).toHaveBeenCalledWith({ actorId: accountId, conversationId, invitationId });
  });

  it("validates link tokens and bounds link expiry choices", async () => {
    const { router, handlers } = buildRouter();
    expect((await dispatch(router, "GET", "/api/v1/conversations/invitation-links/not-a-token/preview")).response.status).toBe(400);
    expect((await dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitation-links`, { expiresInHours: 999 })).response.status).toBe(400);
    expect(handlers.previewLink).not.toHaveBeenCalled();
    expect(handlers.createLink).not.toHaveBeenCalled();
  });

  it("maps link creation, preview, claim, and revocation to authenticated handlers", async () => {
    const { router, handlers } = buildRouter();
    const token = "t".repeat(43);
    expect((await dispatch(router, "POST", `/api/v1/conversations/${conversationId}/invitation-links`, { expiresInHours: 24 })).response.status).toBe(201);
    expect(handlers.createLink).toHaveBeenCalledWith({ actorId: accountId, conversationId, expiresInHours: 24 });
    expect((await dispatch(router, "GET", `/api/v1/conversations/invitation-links/${token}/preview`)).response.status).toBe(200);
    expect(handlers.previewLink).toHaveBeenCalledWith({ token });
    expect((await dispatch(router, "POST", `/api/v1/conversations/invitation-links/${token}/claim`)).response.status).toBe(201);
    expect(handlers.claimLink).toHaveBeenCalledWith({ inviteeId: accountId, token });
    expect((await dispatch(router, "DELETE", `/api/v1/conversations/${conversationId}/invitation-links/${invitationId}`)).response.status).toBe(200);
    expect(handlers.revokeLink).toHaveBeenCalledWith({ actorId: accountId, conversationId, linkId: invitationId });
  });

  it("validates link-list cursor and limit and maps the current account", async () => {
    const { router, handlers } = buildRouter();
    expect((await dispatch(router, "GET", `/api/v1/conversations/${conversationId}/invitation-links?limit=101`)).response.status).toBe(400);
    expect((await dispatch(router, "GET", `/api/v1/conversations/${conversationId}/invitation-links?cursor=bad`)).response.status).toBe(400);
    expect(handlers.listLinks).not.toHaveBeenCalled();

    expect((await dispatch(router, "GET", `/api/v1/conversations/${conversationId}/invitation-links?limit=1&cursor=${invitationId}`)).response.status).toBe(200);
    expect(handlers.listLinks).toHaveBeenCalledWith({ actorId: accountId, conversationId, cursor: invitationId, limit: 1 });
  });
});
