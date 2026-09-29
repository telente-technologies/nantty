import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { AUTOMATION_ACTION_TYPES, AUTOMATION_TRIGGERS, CONDITION_OPERATORS } from "../models/automation.model.js";
import { FIELD_PATH_PATTERN } from "../services/conditionEvaluator.service.js";

const MAXIMUM_WINDOW_SECONDS = 7 * 86_400;

const ConditionValueSchema = schema.union([
  schema.string().max(200),
  schema.number(),
  schema.boolean(),
  schema.array(schema.union([schema.string().max(200), schema.number()])).max(50),
]);

const ConditionSchema = schema.object({
  field: schema.string().regex(FIELD_PATH_PATTERN),
  operator: schema.enum(CONDITION_OPERATORS),
  value: schema.optional(ConditionValueSchema),
});

const ActionSchema = schema.object({
  type: schema.enum(AUTOMATION_ACTION_TYPES),
  params: schema.object({ priority: schema.number().int().min(0).max(100).optional(), userField: schema.string().regex(FIELD_PATH_PATTERN).optional() }).optional(),
});

const ThresholdSchema = schema.object({ count: schema.number().int().min(1).max(1000), withinSeconds: schema.number().int().min(1).max(MAXIMUM_WINDOW_SECONDS) });

export const CreateRuleBodySchema = schema.object({
  name: schema.string().min(3).max(120),
  description: schema.string().max(1000).optional(),
  trigger: schema.enum(AUTOMATION_TRIGGERS),
  conditions: schema.array(ConditionSchema).max(10).optional(),
  actions: schema.array(ActionSchema).min(1).max(5),
  threshold: schema.optional(schema.nullable(ThresholdSchema)),
  cooldownSeconds: schema.optional(schema.nullable(schema.number().int().min(0).max(30 * 86_400))),
  maxExecutionsPerHour: schema.number().int().min(1).max(10_000).optional(),
  enabled: schema.boolean().optional(),
});

export const UpdateRuleBodySchema = schema.object({
  name: schema.string().min(3).max(120).optional(),
  description: schema.string().max(1000).optional(),
  conditions: schema.array(ConditionSchema).max(10).optional(),
  actions: schema.array(ActionSchema).min(1).max(5).optional(),
  threshold: schema.optional(schema.nullable(ThresholdSchema)),
  cooldownSeconds: schema.optional(schema.nullable(schema.number().int().min(0).max(30 * 86_400))),
  maxExecutionsPerHour: schema.number().int().min(1).max(10_000).optional(),
  enabled: schema.boolean().optional(),
});

export const RuleParamsSchema = schema.object({ id: schema.string().uuid() });

export const ListExecutionsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type CreateRuleBody = Infer<typeof CreateRuleBodySchema>;
export type UpdateRuleBody = Infer<typeof UpdateRuleBodySchema>;
