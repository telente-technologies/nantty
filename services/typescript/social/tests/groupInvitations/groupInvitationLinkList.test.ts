import { afterEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { conversationRepository } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { groupInvitationLinkRepository } from "../../src/modules/groupInvitations/repositories/groupInvitationLink.repository.js";
import { listGroupInvitationLinksHandler } from "../../src/modules/groupInvitations/queries/listGroupInvitationLinks/listGroupInvitationLinks.handler.js";

const ownerId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const conversationId = "01a12b3d-d5cc-7e11-bc61-000000000003";
const cursor = "01a12b3d-d5cc-7e11-bc61-000000000004";
const expiredLinkId = "01a12b3d-d5cc-7e11-bc61-000000000005";
const nextLinkId = "01a12b3d-d5cc-7e11-bc61-000000000006";
const now = new Date("2026-11-06T12:00:00.000Z");

afterEach(() => vi.restoreAllMocks());

function context(): HandlerContext {
  return {
    database: { client: {}, transaction: async (work: (transaction: never) => Promise<unknown>) => work({} as never) },
    clock: { now: () => now },
  } as unknown as HandlerContext;
}

function group(kind = "group", role: "owner" | "admin" | "member" = "owner") {
  return { id: conversationId, kind, members: [{ conversationId, accountId: ownerId, role, leftAt: null }] };
}

describe("admin group invitation-link listing", () => {
  it("returns a safe cursor page and retains expired/revoked rows for management", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group() as never);
    const cursorLookup = vi.spyOn(groupInvitationLinkRepository, "findCursorInConversation").mockResolvedValue({ id: cursor } as never);
    const page = vi.spyOn(groupInvitationLinkRepository, "pageForConversation").mockResolvedValue([
      { id: expiredLinkId, conversationId, createdAt: new Date(now.getTime() - 100_000), expiresAt: new Date(now.getTime() - 1), revokedAt: new Date(now.getTime() - 10_000) },
      { id: nextLinkId, conversationId, createdAt: new Date(now.getTime() - 50_000), expiresAt: new Date(now.getTime() + 100_000), revokedAt: null },
    ] as never);
    const result = await listGroupInvitationLinksHandler(context())({ actorId: ownerId, conversationId, cursor, limit: 1 });

    expect(cursorLookup).toHaveBeenCalledWith(expect.anything(), cursor, conversationId);
    expect(page).toHaveBeenCalledWith(expect.anything(), conversationId, 1, cursor);
    expect(result).toEqual({
      data: [{ id: expiredLinkId, conversationId, createdAt: new Date(now.getTime() - 100_000).toISOString(), expiresAt: new Date(now.getTime() - 1).toISOString(), revokedAt: new Date(now.getTime() - 10_000).toISOString() }],
      nextCursor: expiredLinkId,
    });
    expect(JSON.stringify(result)).not.toMatch(/tokenHash|token|encrypted|history/i);
  });

  it("rejects cursors from another group or unknown link IDs", async () => {
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group() as never);
    vi.spyOn(groupInvitationLinkRepository, "findCursorInConversation").mockResolvedValue(null);
    const page = vi.spyOn(groupInvitationLinkRepository, "pageForConversation");
    await expect(listGroupInvitationLinksHandler(context())({ actorId: ownerId, conversationId, cursor, limit: 20 })).rejects.toMatchObject({ status: 400, code: "INVALID_GROUP_INVITATION_LINK_CURSOR" });
    expect(page).not.toHaveBeenCalled();
  });

  it("requires a current group owner/admin and rejects channel conversations and ordinary members", async () => {
    const handler = listGroupInvitationLinksHandler(context());
    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group("channel") as never);
    await expect(handler({ actorId: ownerId, conversationId, limit: 20 })).rejects.toMatchObject({ status: 403, code: "NOT_A_GROUP" });

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group("group", "member") as never);
    await expect(handler({ actorId: ownerId, conversationId, limit: 20 })).rejects.toMatchObject({ status: 403, code: "NOT_GROUP_ADMIN" });

    vi.spyOn(conversationRepository, "findById").mockResolvedValue(group("group", "admin") as never);
    vi.spyOn(groupInvitationLinkRepository, "pageForConversation").mockResolvedValue([]);
    await expect(handler({ actorId: ownerId, conversationId, limit: 20 })).resolves.toEqual({ data: [], nextCursor: null });
  });
});
