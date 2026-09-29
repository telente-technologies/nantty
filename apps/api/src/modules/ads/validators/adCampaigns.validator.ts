import { schema, type Infer } from "@zudojs/schema";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const MoneySchema = schema.object({
  amountMinor: schema.number().int().min(0).max(1_000_000_000_000),
  currency: schema.string().min(3).max(3),
});

const BudgetSchema = schema.object({ type: schema.enum(["daily", "lifetime"]), amount: MoneySchema });
const ScheduleSchema = schema.object({ startAt: schema.string().min(10).max(40), endAt: schema.optional(schema.nullable(schema.string().min(10).max(40))) });
const placementSchema = schema.enum(["feed", "clips", "mart", "search", "stories", "live"]);

const LocationSchema = schema.object({
  type: schema.enum(["country", "state", "city"]),
  code: schema.string().min(1).max(64),
  name: schema.string().min(1).max(120),
  countryCode: schema.string().min(2).max(2),
  parentName: schema.optional(schema.nullable(schema.string().max(120))),
});

const idList = (maximum: number) => schema.array(schema.string().regex(IDENTIFIER)).max(maximum).default([]);

export const AudienceSpecSchema = schema.object({
  locations: schema.array(LocationSchema).max(50).default([]),
  excludedLocations: schema.array(LocationSchema).max(50).default([]),
  ageMin: schema.number().int().min(13).max(65),
  ageMax: schema.number().int().min(13).max(65),
  gender: schema.enum(["all", "female", "male"]).default("all"),
  topicIds: idList(25),
  behaviourIds: idList(25),
  customAudienceIds: idList(20),
  excludedCustomAudienceIds: idList(20),
});

export const CampaignInputSchema = schema.object({
  name: schema.string().max(200),
  objective: schema.enum(["awareness", "traffic", "engagement", "messages", "sales", "followers", "store_promotion"]),
  budgetLevel: schema.enum(["campaign", "ad_set"]),
  budget: schema.optional(schema.nullable(BudgetSchema)),
  spendCap: schema.optional(schema.nullable(MoneySchema)),
  schedule: ScheduleSchema,
});

export const AdSetInputSchema = schema.object({
  name: schema.string().max(200),
  audience: AudienceSpecSchema,
  placementMode: schema.enum(["automatic", "manual"]),
  placements: schema.array(placementSchema).max(6).default([]),
  schedule: ScheduleSchema,
  budget: schema.optional(schema.nullable(BudgetSchema)),
  bidStrategy: schema.object({ type: schema.enum(["auto", "max_cpc", "max_cpm", "target_cost"]), amount: schema.optional(schema.nullable(MoneySchema)) }),
  frequencyCap: schema.optional(schema.nullable(schema.object({ impressions: schema.number().int(), perDays: schema.number().int() }))),
  conversionEventId: schema.optional(schema.nullable(schema.string().max(64))),
});

export const CreativeInputSchema = schema.object({
  format: schema.enum(["feed_post", "clip", "product", "store", "story", "live"]),
  source: schema.object({ type: schema.enum(["post", "clip", "product", "store", "live", "upload"]), id: schema.string().max(64).default("") }),
  mediaIds: schema.array(schema.string().max(64)).max(10).default([]),
  headline: schema.string().max(200),
  primaryText: schema.string().max(2_000).default(""),
  callToAction: schema.enum(["shop_now", "learn_more", "visit_store", "send_message", "follow", "watch_more", "order_now", "sign_up"]),
  destination: schema.object({
    type: schema.enum(["post", "profile", "store", "product", "messages", "url"]),
    targetId: schema.optional(schema.nullable(schema.string().max(64))),
    url: schema.optional(schema.nullable(schema.string().max(2_048))),
  }),
});

export const AdInputSchema = schema.object({ name: schema.string().max(200).default(""), creative: CreativeInputSchema });

export const CampaignDraftSubmissionSchema = schema.object({
  campaign: CampaignInputSchema,
  adSet: AdSetInputSchema,
  ads: schema.array(AdInputSchema).max(6),
  submitForReview: schema.boolean().default(false),
});

export const UpdateCampaignBodySchema = schema.object({
  name: schema.string().max(200).optional(),
  objective: schema.string().max(40).optional(),
  budgetLevel: schema.enum(["campaign", "ad_set"]).optional(),
  budget: schema.optional(schema.nullable(BudgetSchema)),
  spendCap: schema.optional(schema.nullable(MoneySchema)),
  schedule: ScheduleSchema.optional(),
  status: schema.enum(["active", "paused"]).optional(),
});

export const AdSetCampaignReferenceSchema = schema.object({ campaignId: schema.string().uuid() });

export const UpdateAdSetBodySchema = schema.object({
  name: schema.string().max(200).optional(),
  audience: AudienceSpecSchema.optional(),
  placementMode: schema.enum(["automatic", "manual"]).optional(),
  placements: schema.array(placementSchema).max(6).optional(),
  schedule: ScheduleSchema.optional(),
  budget: schema.optional(schema.nullable(BudgetSchema)),
  bidStrategy: schema.object({ type: schema.enum(["auto", "max_cpc", "max_cpm", "target_cost"]), amount: schema.optional(schema.nullable(MoneySchema)) }).optional(),
  frequencyCap: schema.optional(schema.nullable(schema.object({ impressions: schema.number().int(), perDays: schema.number().int() }))),
  status: schema.enum(["active", "paused"]).optional(),
});

export const CreateAdBodySchema = schema.object({ adSetId: schema.string().uuid(), name: schema.string().max(200).default(""), creative: CreativeInputSchema });

export const UpdateAdBodySchema = schema.object({
  name: schema.string().max(200).optional(),
  creative: CreativeInputSchema.optional(),
  status: schema.enum(["active", "paused"]).optional(),
});

export const AppealBodySchema = schema.object({ message: schema.string().min(20).max(1_000) });

export const BulkActionBodySchema = schema.object({
  level: schema.enum(["campaign", "ad_set", "ad"]),
  ids: schema.array(schema.string().uuid()).min(1).max(100),
  action: schema.enum(["pause", "resume", "archive", "duplicate", "submit_for_review"]),
});

export const DeliveryRangeQuerySchema = schema.object({
  from: schema.string().regex(DATE_ONLY).optional(),
  to: schema.string().regex(DATE_ONLY).optional(),
  cursor: schema.string().max(64).optional(),
  limit: schema.coerce.number().int().min(1).max(200).optional(),
  status: schema.enum(["draft", "in_review", "active", "paused", "completed", "rejected"]).optional(),
  objective: schema.string().max(40).optional(),
  search: schema.string().max(120).optional(),
  campaignId: schema.string().uuid().optional(),
  adSetId: schema.string().uuid().optional(),
  reviewStatus: schema.enum(["not_submitted", "pending", "approved", "rejected"]).optional(),
});

export type CampaignInputBody = Infer<typeof CampaignInputSchema>;
export type AdSetInputBody = Infer<typeof AdSetInputSchema>;
export type CreativeInputBody = Infer<typeof CreativeInputSchema>;
export type CampaignDraftSubmissionBody = Infer<typeof CampaignDraftSubmissionSchema>;
export type UpdateCampaignBody = Infer<typeof UpdateCampaignBodySchema>;
export type UpdateAdSetBody = Infer<typeof UpdateAdSetBodySchema>;
export type UpdateAdBody = Infer<typeof UpdateAdBodySchema>;
export type DeliveryRangeQuery = Infer<typeof DeliveryRangeQuerySchema>;
export type BulkActionBody = Infer<typeof BulkActionBodySchema>;
