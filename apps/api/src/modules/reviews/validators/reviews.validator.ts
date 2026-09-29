import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const CreateReviewBodySchema = schema.object({
  orderId: schema.string().uuid(),
  rating: schema.number().int().min(1).max(5),
  text: schema.string().max(2000).optional(),
});

export const ReplyToReviewBodySchema = schema.object({ reply: schema.string().min(1).max(1000) });

export const ReviewParamsSchema = schema.object({ id: schema.string().uuid() });

export const ReviewListQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type CreateReviewBody = Infer<typeof CreateReviewBodySchema>;
