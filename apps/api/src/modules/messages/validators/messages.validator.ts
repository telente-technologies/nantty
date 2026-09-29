import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const StartConversationBodySchema = schema.object({ userId: schema.string().uuid() });

export const ConversationParamsSchema = schema.object({ id: schema.string().uuid() });

export const ListConversationsQuerySchema = schema.object({
  filter: schema.enum(["all", "direct"]).optional(),
  q: schema.string().max(80).optional(),
});

export const SendMessageBodySchema = schema.object({
  text: schema.string().min(1).max(2000),
  media: schema.array(schema.object({ url: schema.string().url().max(2048), type: schema.enum(["image", "video"]) })).max(4).optional(),
});

export const ListMessagesQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const SearchMessagesQuerySchema = schema.object({ q: schema.string().min(1).max(80) });

export type SendMessageBody = Infer<typeof SendMessageBodySchema>;
