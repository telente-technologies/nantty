import { describe, expect, it } from "vitest";

import { createGetChatReportabilityHandler } from "../../src/modules/internalSources/queries/getChatReportability/getChatReportability.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const conversationId = "0192f0a0-0000-7000-8000-0000000000d1";
const otherConversationId = "0192f0a0-0000-7000-8000-0000000000d2";
const reporter = "0192f0a0-0000-7000-8000-0000000000e1";
const peer = "0192f0a0-0000-7000-8000-0000000000e2";
const formerMember = "0192f0a0-0000-7000-8000-0000000000e3";
const outsider = "0192f0a0-0000-7000-8000-0000000000e4";
const messageId = "0192f0a0-0000-7000-8000-0000000000f1";
const foreignMessageId = "0192f0a0-0000-7000-8000-0000000000f2";

function contextWithConversation(): HandlerContext {
  const members = [{ accountId: reporter, leftAt: null }, { accountId: peer, leftAt: null }, { accountId: formerMember, leftAt: new Date() }];
  const client = {
    conversation: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === conversationId ? { id: conversationId, kind: "group", members: members.filter((member) => member.leftAt === null) } : null,
    },
    conversationMember: {
      findUnique: async ({ where }: { where: { conversationId_accountId: { conversationId: string; accountId: string } } }) => {
        const key = where.conversationId_accountId;
        return key.conversationId === conversationId && members.some((member) => member.accountId === key.accountId) ? { accountId: key.accountId } : null;
      },
    },
    message: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === messageId ? { conversationId } : where.id === foreignMessageId ? { conversationId: otherConversationId } : null,
    },
  };
  return { database: { client } } as unknown as HandlerContext;
}

describe("chat reportability for the trust intake", () => {
  const check = createGetChatReportabilityHandler(contextWithConversation());

  it("accepts a member reporting someone who was in the conversation", async () => {
    await expect(check({ conversationId, reporterId: reporter, reportedUserId: peer, messageId })).resolves.toEqual({ reportable: true });
    await expect(check({ conversationId, reporterId: reporter, reportedUserId: formerMember })).resolves.toEqual({ reportable: true });
  });

  it("refuses a reporter who is not in the conversation", async () => {
    await expect(check({ conversationId, reporterId: outsider, reportedUserId: peer })).rejects.toMatchObject({ code: "NOT_A_MEMBER" });
    await expect(check({ conversationId: otherConversationId, reporterId: reporter })).rejects.toMatchObject({ code: "NOT_A_MEMBER" });
  });

  it("refuses a reported user or message from outside the conversation", async () => {
    await expect(check({ conversationId, reporterId: reporter, reportedUserId: outsider })).rejects.toMatchObject({ code: "REPORTED_USER_NOT_IN_CONVERSATION" });
    await expect(check({ conversationId, reporterId: reporter, messageId: foreignMessageId })).rejects.toMatchObject({ code: "TARGET_NOT_FOUND" });
    await expect(check({ conversationId, reporterId: reporter, reportedUserId: reporter })).rejects.toMatchObject({ code: "SELF_REPORT" });
  });
});
