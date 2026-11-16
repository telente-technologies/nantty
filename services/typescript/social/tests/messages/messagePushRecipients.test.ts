import { describe, expect, it } from "vitest";

import type { Message } from "../../src/generated/prisma/client.js";
import type { ConversationRow } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { applyMessageDelivery } from "../../src/modules/messages/services/messageDelivery.service.js";
import type { Db } from "../../src/types/database.type.js";

const now = new Date("2026-10-10T12:00:00Z");
const member = (accountId: string, extra: Record<string, unknown> = {}) => ({ accountId, inboxFolder: "chats", mutedAlways: false, mutedUntil: null, leftAt: null, role: "member", ...extra });

function fakeDb(settings: readonly Record<string, unknown>[]): Db {
  return {
    conversation: { update: async () => ({}) },
    conversationMember: { updateMany: async () => ({ count: 1 }) },
    chatSettings: { findMany: async ({ where }: { where: { accountId: { in: string[] } } }) => settings.filter((row) => where.accountId.in.includes(String(row["accountId"]))) },
  } as unknown as Db;
}

async function deliver(members: readonly Record<string, unknown>[], settings: readonly Record<string, unknown>[] = []) {
  const conversation = { id: "c1", kind: "group", title: "Fabric lovers", members } as unknown as ConversationRow;
  const message = { id: "m1", conversationId: "c1", senderId: "s", kind: "text", createdAt: now } as unknown as Message;
  const events = await applyMessageDelivery(fakeDb(settings), {
    conversation, message, now, isNewConversation: false, messageEnvelope: {}, actor: { id: "s", name: "Ada" },
    mentions: { userIdsToNotify: [], mentionsAll: false } as never,
  });
  return events.find((event) => event.eventType === "message.sent")!.data as Record<string, unknown>;
}

describe("message push recipients", () => {
  it("pushes to members in their chats folder who have not muted the chat or turned group pushes off", async () => {
    const data = await deliver(
      [member("s"), member("a"), member("muted", { mutedAlways: true }), member("snoozed", { mutedUntil: new Date("2026-10-11T00:00:00Z") }), member("expired", { mutedUntil: new Date("2026-10-09T00:00:00Z") }), member("request", { inboxFolder: "requests" }), member("off"), member("private")],
      [{ accountId: "off", notifyMessages: true, notifyGroups: false, showMessagePreview: true }, { accountId: "private", notifyMessages: true, notifyGroups: true, showMessagePreview: false }],
    );
    expect(data["pushRecipients"]).toEqual([
      { userId: "a", showPreview: true, sound: true, vibration: true, bubbleAllowed: false },
      { userId: "expired", showPreview: true, sound: true, vibration: true, bubbleAllowed: false },
      { userId: "private", showPreview: false, sound: true, vibration: true, bubbleAllowed: false },
    ]);
    expect(data).toMatchObject({ senderName: "Ada", conversationKind: "group", conversationTitle: null });
    expect(JSON.stringify(data)).not.toContain("Fabric lovers");
    expect(JSON.stringify(data)).not.toContain("ciphertext");
  });

  it("sends no push list when everyone muted the chat", async () => {
    const data = await deliver([member("s"), member("a", { mutedAlways: true })]);
    expect(data["pushRecipients"]).toEqual([]);
  });
});
