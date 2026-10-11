import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import { type EncryptionRecipients, resolveEncryptionRecipients } from "../../services/encryptionRecipients.service.js";
import type { GetEncryptionRecipientsQuery } from "./getEncryptionRecipients.query.js";

export function createGetEncryptionRecipientsHandler(context: HandlerContext): Handler<GetEncryptionRecipientsQuery, EncryptionRecipients> {
  return async ({ viewerId, conversationId }) => {
    const { conversation } = await requireConversationMember(context.database.client, conversationId, viewerId);
    return resolveEncryptionRecipients(context, conversation);
  };
}
