import { schema } from "@zudojs/schema";

import { sendMessageBodySchema } from "../../messages/validators/messages.validator.js";

const identifier = schema.string().uuid();

export const storeParamsSchema = schema.object({ storeId: identifier });
export const storeConversationParamsSchema = schema.object({ storeId: identifier, conversationId: identifier });
export const listStoreConversationsQuerySchema = schema.object({
  filter: schema.enum(["all", "unread", "orders"]).optional(),
  cursor: identifier.optional(),
  limit: schema.coerce.number().int().min(1).max(200).optional(),
});
export const threadQuerySchema = schema.object({ cursor: identifier.optional(), after: identifier.optional(), limit: schema.coerce.number().int().min(1).max(200).optional() });
export const buyerStoreMessageBodySchema = sendMessageBodySchema.extend(schema.object({ body: schema.optional(schema.unknown()) }));
export const storeMessageBodySchema = buyerStoreMessageBodySchema.extend(schema.object({
  senderAccountId: identifier,
  senderName: schema.string().min(1).max(80),
  clientMessageId: schema.string().min(1).max(100).optional(),
}));
export const openStoreConversationBodySchema = schema.object({ buyerAccountId: identifier, orderId: identifier.optional(), orderNumber: schema.string().min(1).max(40).optional() });
