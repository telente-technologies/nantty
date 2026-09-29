import { schema } from "@zudojs/schema";

const roleSchema = schema.enum(["admin", "advertiser", "analyst", "billing"]);

export const CreateAdAccountBodySchema = schema.object({
  name: schema.string().min(1).max(120),
  kind: schema.enum(["personal", "business"]),
  storeId: schema.optional(schema.nullable(schema.string().uuid())),
  countryCode: schema.string().min(2).max(2),
  timezone: schema.string().min(1).max(64),
});

export const UpdateAdAccountBodySchema = schema.object({
  name: schema.string().min(1).max(120).optional(),
  timezone: schema.string().min(1).max(64).optional(),
});

export const ChangeMemberRoleBodySchema = schema.object({ role: roleSchema });

export const CreateInviteBodySchema = schema.object({
  email: schema.string().min(3).max(254),
  role: roleSchema,
});

export const ActivityQuerySchema = schema.object({
  objectType: schema.enum(["account", "member", "invite", "campaign", "ad_set", "ad", "billing", "boost"]).optional(),
  cursor: schema.string().max(64).optional(),
  limit: schema.coerce.number().int().min(1).max(200).optional(),
});

export const AdsPageQuerySchema = schema.object({
  cursor: schema.string().max(64).optional(),
  limit: schema.coerce.number().int().min(1).max(200).optional(),
});
