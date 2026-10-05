import { describe, expect, it } from "vitest";

import { createSendStoreMessageHandler } from "../../src/modules/storeInbox/commands/sendStoreMessage/sendStoreMessage.handler.js";
import { storeConversationKey, storePlaintextProtocol } from "../../src/modules/storeInbox/models/storeInbox.model.js";
import { buildStoreMessageView, buyerIdOf, cleanStoreMessageBody } from "../../src/modules/storeInbox/services/storeInboxView.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const storeId = "0192a4f0-0000-7000-8000-00000000aaaa";
const buyerId = "0192a4f0-0000-7000-8000-00000000bbbb";
const conversation = { id: "0192a4f0-0000-7000-8000-00000000cccc", kind: "business", storeId, createdById: buyerId, members: [{ accountId: buyerId, unreadCount: 0 }, { accountId: storeId, unreadCount: 2 }] };

function contextWithConversation(): HandlerContext {
  const client = { conversation: { findFirst: async ({ where }: { where: { id: string; storeId: string } }) => (where.id === conversation.id && where.storeId === storeId ? conversation : null) } };
  return { database: { client, transaction: async () => { throw new Error("must not write"); } }, clock: { now: () => new Date("2026-10-05T09:00:00Z") } } as unknown as HandlerContext;
}

describe("store inbox", () => {
  it("strips markup and control characters from plain-text messages", () => {
    expect(cleanStoreMessageBody("  <b>Hello</b>\u0007 there <script>x</script> ")).toBe("Hello there x");
  });

  it("shows staff names on store replies and never leaks encrypted chat as text", () => {
    const base = { id: "m1", conversationId: conversation.id, createdAt: new Date("2026-10-05T09:00:00Z") };
    expect(buildStoreMessageView({ ...base, senderId: storeId, senderLabel: "Tolu (Ada Fabrics)", ciphertext: "On its way", protocol: storePlaintextProtocol }, storeId, "Kemi")).toMatchObject({ from: "seller", senderName: "Tolu (Ada Fabrics)", body: "On its way" });
    expect(buildStoreMessageView({ ...base, senderId: buyerId, senderLabel: null, ciphertext: "opaque", protocol: "signal-v1" }, storeId, "Kemi").body).toBe("This message is end-to-end encrypted.");
    expect(buyerIdOf(conversation as never, storeId)).toBe(buyerId);
    expect(storeConversationKey(storeId, buyerId)).toBe(`store:${storeId}:${buyerId}`);
  });

  it("refuses another store or a buyer outside the conversation with the same 404", async () => {
    const send = createSendStoreMessageHandler(contextWithConversation());
    await expect(send({ storeId: buyerId, conversationId: conversation.id, senderId: buyerId, senderLabel: null, actorName: "x", body: "hi" })).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
    await expect(send({ storeId, conversationId: conversation.id, senderId: "0192a4f0-0000-7000-8000-00000000dddd", senderLabel: null, actorName: "x", body: "hi" })).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
    await expect(send({ storeId, conversationId: conversation.id, senderId: storeId, senderLabel: "Tolu", actorName: "Tolu", body: "<p></p>" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
