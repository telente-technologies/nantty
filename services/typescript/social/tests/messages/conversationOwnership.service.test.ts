import { describe, expect, it } from "vitest";

import { requireConversationMember } from "../../src/modules/conversations/services/conversationAccess.service.js";
import type { Db } from "../../src/types/database.type.js";

function databaseWithConversation(memberIds: readonly string[]): Db {
  const conversation = { id: "conversation-1", kind: "direct", members: memberIds.map((accountId) => ({ accountId, role: "member" })) };
  return { conversation: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === conversation.id ? conversation : null) } } as unknown as Db;
}

async function captureError(work: Promise<unknown>): Promise<{ status?: number; code?: string }> {
  try {
    await work;
  } catch (error) {
    return error as { status?: number; code?: string };
  }
  throw new Error("expected a rejection");
}

describe("conversation ownership", () => {
  it("answers a stranger with the same 404 as a conversation that does not exist", async () => {
    const database = databaseWithConversation(["alice", "bob"]);
    const stranger = await captureError(requireConversationMember(database, "conversation-1", "mallory"));
    const missing = await captureError(requireConversationMember(database, "conversation-404", "mallory"));
    expect(stranger.code).toBe("CONVERSATION_NOT_FOUND");
    expect(missing.code).toBe(stranger.code);
    expect(missing.status).toBe(stranger.status);
    await expect(requireConversationMember(database, "conversation-1", "alice")).resolves.toMatchObject({ member: { accountId: "alice" } });
  });
});
