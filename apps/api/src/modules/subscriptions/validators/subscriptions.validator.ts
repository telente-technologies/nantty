import { schema } from "@zudojs/schema";

import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";
import { ENTITLEMENT_VALUE_TYPES, type EntitlementKey } from "../../../interfaces/entitlements.interface.js";
import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { BILLING_INTERVALS, SUBSCRIPTION_STATUSES } from "../models/subscriptions.model.js";

const ENTITLEMENT_KEYS = Object.keys(ENTITLEMENT_VALUE_TYPES) as [EntitlementKey, ...EntitlementKey[]];

const checkoutFields = {
  interval: schema.enum(BILLING_INTERVALS).optional(),
  provider: schema.enum(["paystack", "flutterwave"]).optional(),
  trial: schema.boolean().optional(),
  returnTo: schema.string().min(3).max(300).optional(),
};

export const PersonalCheckoutBodySchema = schema.object({ plan: schema.enum(["ESSENTIAL", "VERIFIED", "PREMIUM"]), ...checkoutFields });

export const SellerCheckoutBodySchema = schema.object({ plan: schema.enum(["PRO", "PREMIUM"]), ...checkoutFields });

export const VerifySubscriptionBodySchema = schema.object({ reference: schema.string().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/) });

export const StoreScopeQuerySchema = schema.object({ storeId: schema.string().uuid().optional() });

export const ProfileParamsSchema = schema.object({ profileId: schema.string().uuid() });

export const PlanParamsSchema = schema.object({ id: schema.string().uuid() });

export const ChangePlanBodySchema = schema.object({ plan: schema.enum(["ESSENTIAL", "VERIFIED", "PREMIUM", "PRO"]) });

export const ListSubscriptionsQuerySchema = schema.object({
  status: schema.enum(SUBSCRIPTION_STATUSES).optional(),
  plan: schema.enum(["ESSENTIAL", "VERIFIED", "PREMIUM", "PRO", "OFFICIAL"]).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const UpdatePlanBodySchema = schema.object({
  name: schema.string().min(2).max(80).optional(),
  description: schema.string().max(500).optional(),
  trialDays: schema.number().int().min(0).max(90).optional(),
  active: schema.boolean().optional(),
  sortOrder: schema.number().int().min(0).max(1000).optional(),
});

export const ReplacePricesBodySchema = schema.object({
  prices: schema.array(schema.object({
    interval: schema.enum(BILLING_INTERVALS),
    currency: schema.enum(SUPPORTED_CURRENCY_CODES),
    amount: schema.number().int().min(100).max(1_000_000_000),
  })).max(30),
});

export const ReplaceEntitlementsBodySchema = schema.object({
  entitlements: schema.array(schema.object({
    key: schema.enum(ENTITLEMENT_KEYS),
    value: schema.union([schema.boolean(), schema.number().int().min(-1).max(1_000_000_000), schema.string().min(1).max(40)]),
  })).max(40),
});

export const ReplacePerksBodySchema = schema.object({
  perks: schema.array(schema.object({ title: schema.string().min(2).max(120), description: schema.string().max(300).optional() })).max(20),
});
