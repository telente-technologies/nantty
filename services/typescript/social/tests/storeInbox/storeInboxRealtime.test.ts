import { describe, expect, it } from "vitest";

import { createGetInternalMembershipHandler } from "../../src/modules/conversations/queries/getInternalMembership/getInternalMembership.handler.js";
import { applyMessageDelivery } from "../../src/modules/messages/services/messageDelivery.service.js";
import { createMarkStoreConversationReadHandler } from "../../src/modules/storeInbox/commands/markStoreConversationRead/markStoreConversationRead.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const storeId = "0192a4f0-0000-7000-8000-00000000aaaa";
const buyerId = "0192a4f0-0000-7000-8000-00000000bbbb";
const staffId = "0192a4f0-0000-7000-8000-00000000eeee";
const formerStaffId = "0192a4f0-0000-7000-8000-00000000ffff";
const readAt = new Date("2026-10-05T08:00:00Z");
const conversation = {
  id: "0192a4f0-0000-7000-8000-00000000cccc", kind: "business", storeId, createdById: buyerId, orderId: null, orderNumber: null, lastMessageAt: readAt, disappearingMessagesSeconds: null,
  members: [{ accountId: buyerId, unreadCount: 0, leftAt: null, lastReadAt: readAt, inboxFolder: "requests" }, { accountId: storeId, unreadCount: 2, leftAt: null, lastReadAt: null, inboxFolder: "requests" }],
};

function context(team: readonly string[], outbox: unknown[] = []): HandlerContext {
  const client = {
    conversation: { findFirst: async () => conversation, findUnique: async () => conversation, update: async () => conversation },
    conversationMember: { findFirst: async ({ where }: { where: { accountId: string } }) => conversation.members.find((member) => member.accountId === where.accountId) ?? null, updateMany: async () => ({ count: 1 }) },
    message: { findMany: async () => [] },
    outboxEvent: { createMany: async ({ data }: { data: unknown[] }) => outbox.push(...data) },
  };
  return {
    database: { client, transaction: async (run: (db: unknown) => Promise<unknown>) => run(client) },
    clock: { now: () => new Date("2026-10-05T09:00:00Z") },
    directory: { findUserSummaries: async () => new Map([[buyerId, { name: "Kemi", username: "kemi", avatarUrl: null, verified: false }], [staffId, { name: "Tolu Staff", username: "tolu", avatarUrl: null, verified: false }]]) },
    storeInboxTeam: { memberAccountIds: async () => team },
    shareCards: { resolve: async () => ({ title: "Ada Fabrics", imageUrl: "https://cdn/logo.png" }) },
  } as unknown as HandlerContext;
}

describe("store inbox realtime", () => {
  it("lets current inbox staff join the conversation topic under the store's name, never their own", async () => {
    const view = await createGetInternalMembershipHandler(context([staffId]))({ conversationId: conversation.id, accountId: staffId });
    expect(view).toEqual({ member: true, role: "storeTeam", user: { name: "Ada Fabrics", username: "", avatarUrl: "https://cdn/logo.png", verified: false } });
    expect(JSON.stringify(view)).not.toContain("Tolu");
  });

  it("refuses a staff member who was removed or lost the inbox permission", async () => {
    await expect(createGetInternalMembershipHandler(context([staffId]))({ conversationId: conversation.id, accountId: formerStaffId })).rejects.toMatchObject({ status: 404 });
  });

  it("fans new messages out to the inbox team without adding them to push recipients", async () => {
    const message = { id: "m1", senderId: buyerId, kind: "text", createdAt: readAt };
    const db = context([]).database.client;
    const events = await applyMessageDelivery(db as never, { conversation: conversation as never, message: message as never, mentions: { entities: [], userIdsToNotify: [], mentionsAll: false }, isNewConversation: false, now: readAt, messageEnvelope: { id: "m1" }, actor: { id: buyerId, name: "Kemi" }, storeTeamIds: [staffId] });
    const created = events.find((event) => event.eventType === "message.created");
    const sent = events.find((event) => event.eventType === "message.sent");
    expect(created?.data).toMatchObject({ recipientIds: [storeId], memberIds: [staffId] });
    expect(JSON.stringify(sent?.data)).not.toContain(staffId);
  });

  it("tells the customer and every teammate when the store reads a conversation", async () => {
    const outbox: unknown[] = [];
    const view = await createMarkStoreConversationReadHandler(context([staffId], outbox))({ storeId, conversationId: conversation.id });
    expect(view.customerLastReadAt).toBe(readAt.toISOString());
    expect(JSON.stringify(outbox)).toContain("conversation.read");
    expect(JSON.stringify(outbox)).toContain(staffId);
  });
});

describe("removing a teammate from the store inbox", () => {
  const removalContext = (team: string[], outbox: unknown[], forgotten: string[]) => ({
    database: { client: { conversation: { findMany: async () => [{ id: conversation.id }, { id: "0192a4f0-0000-7000-8000-00000000dddd" }] }, outboxEvent: { createMany: async ({ data }: { data: unknown[] }) => outbox.push(...data) } } },
    storeInboxTeam: { memberAccountIds: async () => team, forget: (storeId: string) => forgotten.push(storeId) },
  }) as unknown as HandlerContext;

  it("kicks a removed staff member out of every store conversation topic at once, after dropping the cached team", async () => {
    const { createRevokeStoreInboxAccessHandler } = await import("../../src/modules/storeInbox/commands/revokeStoreInboxAccess/revokeStoreInboxAccess.handler.js");
    const outbox: { eventType: string; payload: { data: { conversationId: string; accountId: string } } }[] = [];
    const forgotten: string[] = [];
    const revoked = await createRevokeStoreInboxAccessHandler(removalContext([], outbox, forgotten))({ storeId, accountId: formerStaffId, occurredAt: readAt });
    expect(revoked).toBe(2);
    expect(forgotten).toEqual([storeId]);
    expect(outbox.map((event) => [event.eventType, event.payload.data.accountId])).toEqual([["conversation.memberRemoved", formerStaffId], ["conversation.memberRemoved", formerStaffId]]);
  });

  it("does nothing when the teammate still has inbox access, e.g. after an unrelated role edit", async () => {
    const { createRevokeStoreInboxAccessHandler } = await import("../../src/modules/storeInbox/commands/revokeStoreInboxAccess/revokeStoreInboxAccess.handler.js");
    const outbox: unknown[] = [];
    expect(await createRevokeStoreInboxAccessHandler(removalContext([staffId], outbox, []))({ storeId, accountId: staffId, occurredAt: readAt })).toBe(0);
    expect(outbox).toEqual([]);
  });

  it("routes catalog team events to the revoke handler", async () => {
    const { createContentEventRouter } = await import("../../src/modules/contentEvents/services/contentEventRouter.service.js");
    const calls: unknown[] = [];
    const route = createContentEventRouter({ applyContentVisibility: async () => true, applyProcessedMedia: async () => undefined, revokeStoreInboxAccess: async (command) => calls.push(command) });
    await route(JSON.stringify({ type: "store.staff_removed", occurredAt: readAt.toISOString(), data: { storeId, accountId: formerStaffId, role: "sales", status: "removed" } }));
    await route(JSON.stringify({ type: "store.staff_updated", data: { storeId, accountId: staffId } }));
    expect(calls).toMatchObject([{ storeId, accountId: formerStaffId }, { storeId, accountId: staffId }]);
    await expect(route(JSON.stringify({ type: "store.staff_removed", data: { storeId } }))).rejects.toThrow();
  });
});
