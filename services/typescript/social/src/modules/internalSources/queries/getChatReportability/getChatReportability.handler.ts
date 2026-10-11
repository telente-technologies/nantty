import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import type { GetChatReportabilityQuery } from "./getChatReportability.query.js";

export function createGetChatReportabilityHandler(context: HandlerContext): Handler<GetChatReportabilityQuery, { readonly reportable: true }> {
  return async ({ conversationId, reporterId, reportedUserId, messageId }) => {
    const db = context.database.client;
    const access = await requireConversationMember(db, conversationId, reporterId).catch(() => undefined);
    if (access === undefined) throw forbidden("NOT_A_MEMBER", "You can only report conversations you're in.");
    if (reportedUserId !== undefined) {
      if (reportedUserId === reporterId) throw unprocessable("SELF_REPORT", "You can't report yourself.");
      const member = await db.conversationMember.findUnique({ where: { conversationId_accountId: { conversationId, accountId: reportedUserId } }, select: { accountId: true } });
      if (member === null) throw notFound("REPORTED_USER_NOT_IN_CONVERSATION", "That person isn't part of this conversation.");
    }
    if (messageId !== undefined) {
      const message = await db.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
      if (message === null || message.conversationId !== conversationId) throw notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");
    }
    return { reportable: true };
  };
}
