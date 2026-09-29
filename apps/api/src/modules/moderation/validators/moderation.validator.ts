import { schema, type Infer } from "@zudojs/schema";

import { MODERATION_TARGET_TYPES } from "../../../interfaces/moderationTargets.interface.js";
import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { MODERATION_ACTIONS, REPORT_REASONS } from "../models/moderation.model.js";

export const SubmitReportBodySchema = schema.object({
  targetType: schema.enum([...MODERATION_TARGET_TYPES, "clip"]),
  targetId: schema.string().uuid(),
  reason: schema.enum(REPORT_REASONS),
  details: schema.string().max(500).optional(),
});

export const IdParamsSchema = schema.object({ id: schema.string().uuid() });

export const ListCasesQuerySchema = schema.object({
  status: schema.enum(["open", "actioned", "dismissed"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const ListAppealsQuerySchema = schema.object({
  status: schema.enum(["pending", "upheld", "overturned"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const TakeActionBodySchema = schema.object({
  action: schema.enum(MODERATION_ACTIONS),
  reason: schema.string().min(3).max(1000),
  suspensionDays: schema.optional(schema.nullable(schema.number().int().min(1).max(3650))),
});

export const SubmitAppealBodySchema = schema.object({ statement: schema.string().min(10).max(2000) });

export const ResolveAppealBodySchema = schema.object({
  outcome: schema.enum(["upheld", "overturned"]),
  note: schema.string().min(3).max(1000),
});

export type SubmitReportBody = Infer<typeof SubmitReportBodySchema>;
export type TakeActionBody = Infer<typeof TakeActionBodySchema>;
export type ResolveAppealBody = Infer<typeof ResolveAppealBodySchema>;
