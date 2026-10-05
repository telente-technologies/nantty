import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Db } from "../../../../types/database.type.js";
import { conversationRepository, type ConversationRow } from "../../../conversations/repositories/conversation.repository.js";
import { storeConversationKey, type StoreConversationView } from "../../models/storeInbox.model.js";
import { buildStoreConversationViews } from "../../services/storeInboxView.service.js";
import type { OpenStoreConversationCommand } from "./openStoreConversation.command.js";

export async function openStoreConversationRow(db: Db, command: OpenStoreConversationCommand): Promise<ConversationRow> {
  const directKey = storeConversationKey(command.storeId, command.buyerAccountId);
  const existing = await conversationRepository.findDirectByKey(db, directKey);
  if (existing !== null) {
    if (command.orderId !== undefined && existing.orderId === null) {
      await conversationRepository.update(db, existing.id, { orderId: command.orderId, orderNumber: command.orderNumber ?? null });
      return { ...existing, orderId: command.orderId, orderNumber: command.orderNumber ?? null };
    }
    return existing;
  }
  return conversationRepository.create(db, {
    kind: "business", directKey, storeId: command.storeId, createdById: command.buyerAccountId, orderId: command.orderId ?? null, orderNumber: command.orderNumber ?? null,
  }, [{ accountId: command.buyerAccountId, role: "member", inboxFolder: "chats" }, { accountId: command.storeId, role: "owner", inboxFolder: "chats" }]);
}

export function createOpenStoreConversationHandler(context: HandlerContext): Handler<OpenStoreConversationCommand, StoreConversationView> {
  return async (command) => {
    const db = context.database.client;
    const conversation = await openStoreConversationRow(db, command);
    return (await buildStoreConversationViews(context, db, command.storeId, [conversation]))[0] as StoreConversationView;
  };
}
