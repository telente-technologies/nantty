import { schema } from "@zudojs/schema";

const identifier = schema.string().uuid();

export const storeParamsSchema = schema.object({ storeId: identifier });
export const storeConversationParamsSchema = schema.object({ storeId: identifier, conversationId: identifier });
export const listStoreConversationsQuerySchema = schema.object({
  filter: schema.enum(["all", "unread", "orders"]).optional(),
  q: schema.string().max(80).optional(),
  cursor: identifier.optional(),
  limit: schema.coerce.number().int().min(1).max(200).optional(),
});
export const storeMessageBodySchema = schema.object({ body: schema.string().min(1).max(2000), senderAccountId: identifier, senderName: schema.string().min(1).max(80) });
export const buyerStoreMessageBodySchema = schema.object({ body: schema.string().min(1).max(2000) });
export const openStoreConversationBodySchema = schema.object({ buyerAccountId: identifier, orderId: identifier.optional(), orderNumber: schema.string().min(1).max(40).optional() });
