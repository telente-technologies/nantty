import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";

export interface InternalMembershipQuery {
  readonly conversationId: string;
  readonly accountId: string;
}

export interface InternalMembershipView {
  readonly member: true;
  readonly role: string;
  readonly user?: { readonly name: string; readonly username: string; readonly avatarUrl: string | null; readonly verified: boolean };
}

export function createGetInternalMembershipHandler(context: HandlerContext): Handler<InternalMembershipQuery, InternalMembershipView> {
  return async ({ conversationId, accountId }) => {
    const member = await conversationRepository.findMember(context.database.client, conversationId, accountId);
    if (member === null) throw notFound("NOT_A_MEMBER", "Not a member of this conversation.");
    const summary = (await context.directory.findUserSummaries([accountId])).get(accountId);
    return {
      member: true, role: member.role,
      ...(summary === undefined ? {} : { user: { name: summary.name, username: summary.username, avatarUrl: summary.avatarUrl, verified: summary.verified } }),
    };
  };
}
