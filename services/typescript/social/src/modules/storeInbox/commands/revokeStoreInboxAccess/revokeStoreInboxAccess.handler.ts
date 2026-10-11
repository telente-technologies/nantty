import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { membershipEndedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";

export interface RevokeStoreInboxAccessCommand {
  readonly storeId: string;
  readonly accountId: string;
  readonly occurredAt: Date;
}

export const maximumConversationsRevokedAtOnce = 500;

export function createRevokeStoreInboxAccessHandler(context: HandlerContext): Handler<RevokeStoreInboxAccessCommand, number> {
  return async ({ storeId, accountId, occurredAt }) => {
    const team = context.storeInboxTeam;
    if (team === undefined || accountId === storeId) return 0;
    team.forget?.(storeId);
    if ((await team.memberAccountIds(storeId)).includes(accountId)) return 0;
    const conversations = await context.database.client.conversation.findMany({
      where: { storeId, kind: "business" }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: maximumConversationsRevokedAtOnce, select: { id: true },
    });
    if (conversations.length === 0) return 0;
    await appendDomainEventsToOutbox(context.database.client, conversations.map((conversation) => membershipEndedEvent(conversation.id, accountId, "removed", occurredAt)));
    return conversations.length;
  };
}
