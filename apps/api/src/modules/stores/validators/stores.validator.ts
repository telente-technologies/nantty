import { schema, type Infer } from "@zudojs/schema";

import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";
import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const kobo = schema.number().int().min(0).max(100_000_000_000);
const imageUrl = schema.optional(schema.nullable(schema.string().url().max(2048)));

export const SubmitSellerApplicationBodySchema = schema.object({
  storeName: schema.string().min(2).max(80),
  description: schema.string().max(1000).optional(),
  categoryId: schema.string().uuid().optional(),
  phone: schema.string().min(7).max(20),
});

export const ReviewSellerApplicationBodySchema = schema.object({
  decision: schema.enum(["approve", "reject"]),
  note: schema.string().max(500).optional(),
});

export const CreateStoreBodySchema = schema.object({
  name: schema.string().min(2).max(80),
  description: schema.string().max(2000).optional(),
  shippingFee: kobo.optional(),
  discountBps: schema.number().int().min(0).max(9_000).optional(),
  currency: schema.enum(SUPPORTED_CURRENCY_CODES).optional(),
  shippingPolicy: schema.string().max(2000).optional(),
  returnPolicy: schema.string().max(2000).optional(),
  logoUrl: imageUrl,
  bannerUrl: imageUrl,
});

export const UpdateStoreBodySchema = CreateStoreBodySchema.partial();

export const StoreStatusBodySchema = schema.object({
  status: schema.enum(["active", "suspended"]),
  reason: schema.string().max(500).optional(),
});

export const FeatureStoreBodySchema = schema.object({ featured: schema.boolean() });

export const AddStoreMemberBodySchema = schema.object({
  userId: schema.string().uuid(),
  role: schema.enum(["manager", "staff"]),
});

export const StoreParamsSchema = schema.object({ id: schema.string().uuid() });
export const StoreSlugParamsSchema = schema.object({ slug: schema.string().min(1).max(120) });
export const StoreMemberParamsSchema = schema.object({ id: schema.string().uuid(), userId: schema.string().uuid() });
export const ApplicationParamsSchema = schema.object({ id: schema.string().uuid() });

export const ListStoresQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  featured: schema.coerce.boolean().optional(),
});

export const ListSellerApplicationsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  status: schema.enum(["pending", "approved", "rejected"]).optional(),
});

export type SubmitSellerApplicationBody = Infer<typeof SubmitSellerApplicationBodySchema>;
export type ReviewSellerApplicationBody = Infer<typeof ReviewSellerApplicationBodySchema>;
export type CreateStoreBody = Infer<typeof CreateStoreBodySchema>;
export type UpdateStoreBody = Infer<typeof UpdateStoreBodySchema>;
export type AddStoreMemberBody = Infer<typeof AddStoreMemberBodySchema>;
