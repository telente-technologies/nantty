import { describe, expect, it } from "vitest";

import { resolveEncryptionRecipients } from "../../src/modules/conversations/services/encryptionRecipients.service.js";
import { createSendStoreMessageHandler } from "../../src/modules/storeInbox/commands/sendStoreMessage/sendStoreMessage.handler.js";
import { storeConversationKey } from "../../src/modules/storeInbox/models/storeInbox.model.js";
import { buildStoreConversationViews, buyerIdOf } from "../../src/modules/storeInbox/services/storeInboxView.service.js";
import { storeMessageBodySchema } from "../../src/modules/storeInbox/validators/storeInbox.validator.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const storeId = "0192a4f0-0000-7000-8000-00000000aaaa";
const buyerId = "0192a4f0-0000-7000-8000-00000000bbbb";
const staffId = "0192a4f0-0000-7000-8000-00000000eeee";
const formerStaffId = "0192a4f0-0000-7000-8000-00000000ffff";
const conversation = { id: "0192a4f0-0000-7000-8000-00000000cccc", kind: "business", storeId, createdById: buyerId, disappearingMessagesSeconds: null, members: [{ accountId: buyerId, unreadCount: 0, leftAt: null }, { accountId: storeId, unreadCount: 2, leftAt: null }] };
const encryption = { deviceId: "d1", ciphertext: "sealed-envelope" };

function storeContext(team: readonly string[] = [staffId]): HandlerContext {
  const client = {
    conversation: { findFirst: async ({ where }: { where: { id: string; storeId: string } }) => (where.id === conversation.id && where.storeId === storeId ? conversation : null) },
    message: { findFirst: async () => null, count: async () => 1 },
    chatDeviceKey: { findUnique: async () => null },
  };
  return {
    database: { client, transaction: async () => { throw new Error("must not write"); } }, clock: { now: () => new Date("2026-10-05T09:00:00Z") },
    directory: { findUserSummaries: async () => new Map([[buyerId, { name: "Kemi", username: "kemi", avatarUrl: null }]]) },
    storeInboxTeam: { memberAccountIds: async () => team },
  } as unknown as HandlerContext;
}

const reply = (overrides: Record<string, unknown> = {}) => ({ storeId, conversationId: conversation.id, senderAccountId: staffId, senderLabel: "Tolu (Ada Fabrics)", idempotencyKey: undefined, message: { kind: "text" as const, encryption, media: undefined, linkPreview: undefined }, ...overrides });

describe("encrypted store inbox", () => {
  it("encrypts to the customer plus every current inbox team member, never the store pseudo-account", async () => {
    const recipients = await resolveEncryptionRecipients(storeContext([staffId, storeId]), conversation as never);
    expect(recipients.userIds).toEqual([buyerId, staffId]);
    expect(recipients.storeTeamUserIds).toEqual([staffId]);
    await expect(resolveEncryptionRecipients({ ...storeContext(), storeInboxTeam: undefined } as HandlerContext, conversation as never)).rejects.toMatchObject({ status: 503 });
    expect(buyerIdOf(conversation as never, storeId)).toBe(buyerId);
    expect(storeConversationKey(storeId, buyerId)).toBe(`store:${storeId}:${buyerId}`);
  });

  it("rejects an old dashboard's plaintext reply with 422 PLAINTEXT_NOT_ACCEPTED", async () => {
    const send = createSendStoreMessageHandler(storeContext());
    await expect(send(reply({ message: { kind: "text", encryption: undefined, media: undefined, linkPreview: undefined, plaintext: { text: "Your order shipped" } } }))).rejects.toMatchObject({ status: 422, code: "PLAINTEXT_NOT_ACCEPTED" });
    await expect(send(reply({ message: { kind: "text", encryption: undefined, media: undefined, linkPreview: undefined } }))).rejects.toMatchObject({ code: "ENCRYPTION_REQUIRED" });
    expect(storeMessageBodySchema.parse({ body: "hi", senderAccountId: staffId, senderName: "Tolu" })).toMatchObject({ body: "hi" });
  });

  it("refuses a removed team member, another store, and unregistered devices", async () => {
    await expect(createSendStoreMessageHandler(storeContext([staffId]))(reply({ senderAccountId: formerStaffId }))).rejects.toMatchObject({ status: 403, code: "NOT_STORE_INBOX_MEMBER" });
    await expect(createSendStoreMessageHandler(storeContext())(reply({ storeId: buyerId }))).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
    await expect(createSendStoreMessageHandler(storeContext())(reply())).rejects.toMatchObject({ code: "DEVICE_NOT_REGISTERED" });
  });

  it("shows only the kind and side of the latest message in the list, never text", async () => {
    const db = { message: { findMany: async () => [{ conversationId: conversation.id, senderId: staffId, kind: "text", createdAt: new Date("2026-10-05T09:00:00Z") }] } };
    const [view] = await buildStoreConversationViews(storeContext(), db as never, storeId, [{ ...conversation, orderId: null, orderNumber: null, lastMessageAt: new Date("2026-10-05T09:00:00Z") } as never]);
    expect(view?.lastMessage).toEqual({ kind: "text", from: "seller", createdAt: "2026-10-05T09:00:00.000Z" });
    expect(JSON.stringify(view)).not.toContain("body");
  });
});

describe("store inbox blocks", () => {
  it("refuses to open a store conversation when either side blocked the other", async () => {
    const { openStoreConversationRow } = await import("../../src/modules/storeInbox/commands/openStoreConversation/openStoreConversation.handler.js");
    const created: unknown[] = [];
    const db = {
      block: { count: async ({ where }: { where: { OR: { blockerId: string; blockedId: string }[] } }) => (where.OR.some((pair) => pair.blockerId === storeId && pair.blockedId === buyerId) ? 1 : 0) },
      conversation: { findFirst: async () => null, findUnique: async () => null, create: async (args: unknown) => { created.push(args); return conversation; } },
    };
    await expect(openStoreConversationRow(db as never, { storeId, buyerAccountId: buyerId })).rejects.toMatchObject({ code: "MESSAGE_NOT_ALLOWED" });
    expect(created).toEqual([]);
  });
});
