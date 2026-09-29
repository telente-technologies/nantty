import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const OpenDisputeBodySchema = schema.object({
  reason: schema.enum(["not_received", "not_as_described", "damaged", "wrong_item", "other"]),
  details: schema.string().max(2000).optional(),
});

export const ResolveDisputeBodySchema = schema.object({
  outcome: schema.enum(["release", "refund"]),
  note: schema.string().min(3).max(2000),
});

export const DisputeParamsSchema = schema.object({ id: schema.string().uuid() });

export const ListDisputesQuerySchema = schema.object({
  status: schema.enum(["open", "resolved_release", "resolved_refund"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});
