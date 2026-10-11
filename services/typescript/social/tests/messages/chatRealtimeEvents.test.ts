import { describe, expect, it } from "vitest";

import { createGetInternalMembershipHandler } from "../../src/modules/conversations/queries/getInternalMembership/getInternalMembership.handler.js";
import { conversationReadEvent, conversationUpdatedEvent, membershipEndedEvent, messageRemovedEvent, realtimeMessageEnvelope } from "../../src/modules/messages/services/chatRealtimeEvents.service.js";
import type { MessageRow } from "../../src/modules/messages/repositories/message.repository.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const now = new Date("2026-10-05T12:00:00Z");
const conversationId = "0192f0a0-0000-7000-8000-0000000000c1";
const row = {
  id: "0192f0a0-0000-7000-8000-0000000000d1", conversationId, senderId: "s1", kind: "text", createdAt: now, deviceId: "d", ciphertext: "x", protocol: "signal-v1", hiddenAt: null,
} as unknown as MessageRow;

describe("chat realtime events", () => {
  it("puts only the envelope and routing metadata into realtime events", () => {
    expect(Object.keys(realtimeMessageEnvelope(row)).sort()).toEqual(["conversationId", "createdAt", "encryption", "id", "kind", "moderationHidden", "senderId"]);
  });

  it("never puts ciphertext of a hidden message into an event", () => {
    expect(realtimeMessageEnvelope({ ...row, hiddenAt: now } as MessageRow)).toMatchObject({ encryption: null, moderationHidden: true });
    expect(messageRemovedEvent(conversationId, row.id, "moderation", [], now).eventType).toBe("message.removed");
  });

  it("routes private conversation updates to one account and membership endings by type", () => {
    expect(conversationUpdatedEvent(conversationId, { mutedAlways: true }, now, { accountId: "a" }).data).toEqual({ conversationId, changes: { mutedAlways: true }, accountId: "a" });
    expect(membershipEndedEvent(conversationId, "a", "removed", now, "owner").eventType).toBe("conversation.memberRemoved");
    expect(membershipEndedEvent(conversationId, "a", "left", now).data).toEqual({ conversationId, accountId: "a" });
    expect(conversationReadEvent(conversationId, "a", now, ["a", "b"]).data).toMatchObject({ readerId: "a", lastReadAt: now.toISOString() });
  });
});

describe("internal membership lookup", () => {
  const context = (member: unknown) => ({
    database: { client: { conversationMember: { findFirst: async () => member }, conversation: { findUnique: async () => null } } },
    directory: { findUserSummaries: async () => new Map([["a", { id: "a", name: "Ada", username: "ada", avatarUrl: null, verified: true, isCreator: false }]]) },
  }) as unknown as HandlerContext;

  it("returns the member summary realtime shows in typing frames", async () => {
    expect(await createGetInternalMembershipHandler(context({ role: "member" }))({ conversationId, accountId: "a" })).toEqual({ member: true, role: "member", user: { name: "Ada", username: "ada", avatarUrl: null, verified: true } });
  });

  it("returns 404 for non-members", async () => {
    await expect(createGetInternalMembershipHandler(context(null))({ conversationId, accountId: "a" })).rejects.toMatchObject({ status: 404 });
  });
});
