import type { GroupMembershipInvitation } from "../../src/generated/prisma/client.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { requireDirectGroupAddsAllowed } from "../../src/modules/conversations/services/directGroupAddPolicy.service.js";
import { createRespondGroupInvitationHandler } from "../../src/modules/groupInvitations/commands/respondGroupInvitation/respondGroupInvitation.handler.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { conversationRepository } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { createGroupInvitationHandler } from "../../src/modules/groupInvitations/commands/createGroupInvitation/createGroupInvitation.handler.js";

const inviterId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const inviteeId = "01a12b3d-d5cc-7e11-bc61-000000000002";
const conversationId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const invitationId = "01a12b3d-d5cc-7e11-bc61-000000000004";
const now = new Date("2026-11-05T12:00:00.000Z");

afterEach(() => vi.restoreAllMocks());

function invitation(overrides: Partial<GroupMembershipInvitation> = {}): GroupMembershipInvitation {
  return {
    id: invitationId,
    conversationId,
    inviterId,
    inviteeId,
    status: "pending",
    createdAt: new Date(now.getTime() - 1000),
    expiresAt: new Date(now.getTime() + 60_000),
    respondedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function contextWithDatabase(client: Record<string, unknown>): HandlerContext {
  return {
    database: { client, transaction: async (work: (transaction: never) => Promise<unknown>) => work(client as never) },
    clock: { now: () => now },
    directory: { findUserSummaries: async () => new Map([[inviterId, { id: inviterId, name: "Inviter", username: "inviter", avatarUrl: null, verified: false, isCreator: false }]]) },
  } as unknown as HandlerContext;
}

describe("group invitation safety boundary", () => {
  it("keeps default accounts eligible for existing direct-add behavior", async () => {
    const findMany = vi.fn(async () => []);
    await expect(requireDirectGroupAddsAllowed({ chatSettings: { findMany } } as never, [inviteeId])).resolves.toBeUndefined();
    expect(findMany).toHaveBeenCalledWith({ where: { accountId: { in: [inviteeId] }, preventDirectGroupAdds: true }, select: { accountId: true } });
  });

  it("rejects unsolicited direct membership for an account that opted out", async () => {
    const findMany = vi.fn(async () => [{ accountId: inviteeId }]);
    await expect(requireDirectGroupAddsAllowed({ chatSettings: { findMany } } as never, [inviteeId])).rejects.toMatchObject({
      status: 409,
      code: "GROUP_INVITATION_REQUIRED",
    });
  });

  it("allows a group admin to create a bounded invitation without adding the recipient", async () => {
    const group = {
      id: conversationId,
      kind: "group",
      members: [{ conversationId, accountId: inviterId, role: "owner", leftAt: null }],
    };
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group as never);
    const newInvitation = invitation();
    const db = {
      groupMembershipInvitation: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
        create: vi.fn(async (args: { readonly data: Record<string, unknown> }) => ({ ...newInvitation, ...args.data }) as GroupMembershipInvitation),
      },
      block: { count: vi.fn(async () => 0) },
      outboxEvent: { createMany: vi.fn(async () => ({ count: 1 })) },
      conversationMember: { create: vi.fn(), upsert: vi.fn() },
    };
    const context = contextWithDatabase(db);
    context.directory.findUserSummaries = async (ids) => new Map(ids.map((id) => [id, {
      id, name: "Invitee", username: "invitee", avatarUrl: null, verified: false, isCreator: false,
    }]));
    const handler = createGroupInvitationHandler(context);
    const result = await handler({ actorId: inviterId, conversationId, inviteeId });

    expect(result.id).toBe(invitationId);
    expect(result.status).toBe("pending");
    expect(db.groupMembershipInvitation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ conversationId, inviterId, inviteeId, status: "pending" }) }));
    const created = db.groupMembershipInvitation.create.mock.calls[0]?.[0].data;
    expect((created?.expiresAt as Date).getTime() - (created?.createdAt as Date).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(db.conversationMember.create).not.toHaveBeenCalled();
    expect(db.conversationMember.upsert).not.toHaveBeenCalled();
  });

  it("restricts invitation creation to active group owners and admins", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue({
      id: conversationId,
      kind: "group",
      members: [{ conversationId, accountId: inviterId, role: "member", leftAt: null }],
    } as never);
    const handler = createGroupInvitationHandler(contextWithDatabase({}));
    await expect(handler({ actorId: inviterId, conversationId, inviteeId })).rejects.toMatchObject({ status: 403, code: "NOT_GROUP_ADMIN" });
  });

  it("records recipient consent without creating active membership or key access", async () => {
    const current = invitation();
    const findUnique = vi.fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(invitation({ status: "accepted", respondedAt: now }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const outboxCreateMany = vi.fn(async () => ({ count: 1 }));
    const memberCreate = vi.fn();
    const db = {
      groupMembershipInvitation: { findUnique, updateMany },
      outboxEvent: { createMany: outboxCreateMany },
      conversationMember: { create: memberCreate, upsert: memberCreate },
    };
    const handler = createRespondGroupInvitationHandler(contextWithDatabase(db));
    const result = await handler({ accountId: inviteeId, invitationId, decision: "accept" });

    expect(result.status).toBe("accepted");
    expect(result.membershipStatus).toBe("awaiting_secure_key_handoff");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: invitationId, inviteeId, status: "pending", expiresAt: { gt: now } }, data: { status: "accepted", respondedAt: now } }));
    expect(memberCreate).not.toHaveBeenCalled();
    expect(outboxCreateMany).toHaveBeenCalledTimes(1);
  });

  it("does not reveal another recipient's invitation and expires stale invitations", async () => {
    const foreignInvite = invitation({ inviteeId: inviterId });
    const findUnique = vi.fn(async () => foreignInvite);
    const updateMany = vi.fn();
    const handler = createRespondGroupInvitationHandler(contextWithDatabase({ groupMembershipInvitation: { findUnique, updateMany } }));
    await expect(handler({ accountId: inviteeId, invitationId, decision: "accept" })).rejects.toMatchObject({ status: 404, code: "GROUP_INVITATION_NOT_FOUND" });
    expect(updateMany).not.toHaveBeenCalled();

    findUnique.mockResolvedValueOnce(invitation({ expiresAt: new Date(now.getTime() - 1) }));
    await expect(handler({ accountId: inviteeId, invitationId, decision: "accept" })).rejects.toMatchObject({ status: 410, code: "GROUP_INVITATION_EXPIRED" });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: invitationId, status: "pending" }, data: { status: "expired", respondedAt: now } });
  });

  it("makes repeated acceptance idempotent", async () => {
    const findUnique = vi.fn(async () => invitation({ status: "accepted", respondedAt: now }));
    const updateMany = vi.fn();
    const handler = createRespondGroupInvitationHandler(contextWithDatabase({ groupMembershipInvitation: { findUnique, updateMany } }));
    const result = await handler({ accountId: inviteeId, invitationId, decision: "accept" });
    expect(result.status).toBe("accepted");
    expect(result.membershipStatus).toBe("awaiting_secure_key_handoff");
    expect(updateMany).not.toHaveBeenCalled();
  });
});
