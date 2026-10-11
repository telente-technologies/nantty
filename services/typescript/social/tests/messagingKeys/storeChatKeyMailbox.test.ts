import { describe, expect, it } from "vitest";

import { createDepositMailboxHandler } from "../../src/modules/messagingKeys/commands/keyMailbox/keyMailbox.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const storeId = "0192a4f0-0000-7000-8000-00000000aaaa";
const buyerId = "0192a4f0-0000-7000-8000-00000000bbbb";
const staffId = "0192a4f0-0000-7000-8000-00000000eeee";
const strangerId = "0192a4f0-0000-7000-8000-00000000ffff";
const conversationId = "0192a4f0-0000-7000-8000-00000000cccc";
const members = [{ accountId: buyerId, leftAt: null }, { accountId: storeId, leftAt: null }];

function context(kind: "business" | "group", team: readonly string[]) {
  const deposited: unknown[] = [];
  const conversation = { id: conversationId, kind, storeId: kind === "business" ? storeId : null, members };
  const client = {
    chatDeviceKey: { findUnique: async () => ({ deviceId: "device-0001" }) },
    conversation: { findUnique: async () => conversation },
    chatKeyMailboxEntry: { count: async () => 0, createMany: async ({ data }: { data: unknown[] }) => deposited.push(...data) },
  };
  const handlerContext = { database: { client }, storeInboxTeam: { memberAccountIds: async () => team } } as unknown as HandlerContext;
  return { deposit: createDepositMailboxHandler(handlerContext), deposited };
}

const entry = (userId: string) => ({ userId, deviceId: "device-0002", ciphertext: "c2VuZGVyLWtleQ==" });

describe("sender key mailbox for store chats", () => {
  it("lets the buyer hand sender keys to every teammate on the store inbox", async () => {
    const { deposit, deposited } = context("business", [staffId]);
    await expect(deposit({ senderId: buyerId, senderDeviceId: "device-0001", conversationId, entries: [entry(staffId)] })).resolves.toEqual({ accepted: 1 });
    expect(deposited).toHaveLength(1);
  });

  it("lets a teammate, who is not a conversation member row, hand sender keys to the buyer", async () => {
    const { deposit } = context("business", [staffId]);
    await expect(deposit({ senderId: staffId, senderDeviceId: "device-0001", conversationId, entries: [entry(buyerId)] })).resolves.toEqual({ accepted: 1 });
  });

  it("still refuses outsiders and people who lost inbox access", async () => {
    const { deposit } = context("business", []);
    await expect(deposit({ senderId: staffId, senderDeviceId: "device-0001", conversationId, entries: [entry(buyerId)] })).rejects.toMatchObject({ status: 404 });
    await expect(deposit({ senderId: buyerId, senderDeviceId: "device-0001", conversationId, entries: [entry(strangerId)] })).rejects.toMatchObject({ code: "RECIPIENT_NOT_A_MEMBER" });
  });

  it("keeps ordinary groups limited to their members", async () => {
    const { deposit } = context("group", [staffId]);
    await expect(deposit({ senderId: buyerId, senderDeviceId: "device-0001", conversationId, entries: [entry(staffId)] })).rejects.toMatchObject({ code: "RECIPIENT_NOT_A_MEMBER" });
  });
});
