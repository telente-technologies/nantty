import { schema } from "@zudojs/schema";

import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";

const benefit = schema.union([
  schema.string().min(1).max(120),
  schema.object({ name: schema.string().min(1).max(120), description: schema.string().max(500).optional() }),
]);

export const CreatorIdParamsSchema = schema.object({ creatorId: schema.string().uuid() });

export const PlanIdParamsSchema = schema.object({ planId: schema.string().uuid() });

export const SubscriptionIdParamsSchema = schema.object({ id: schema.string().uuid() });

export const CreatePlanBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  description: schema.string().max(1000).optional(),
  price: schema.object({ amountMinor: schema.number().int().min(100).max(1_000_000_000), currency: schema.enum(SUPPORTED_CURRENCY_CODES) }),
  interval: schema.enum(["month", "year"]).default("month"),
  benefits: schema.array(benefit).max(20).default([]),
});

export const UpdatePlanBodySchema = schema.object({
  name: schema.string().min(1).max(80).optional(),
  description: schema.string().max(1000).optional(),
  benefits: schema.array(benefit).max(20).optional(),
  active: schema.boolean().optional(),
});

export const StartSubscriptionBodySchema = schema.object({
  planId: schema.string().uuid(),
  provider: schema.enum(["paystack", "flutterwave"]).optional(),
  returnTo: schema.string().min(3).max(300).optional(),
});

export const VerifySubscriptionBodySchema = schema.object({ reference: schema.string().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/) });
