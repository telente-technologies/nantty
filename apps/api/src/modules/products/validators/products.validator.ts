import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const minorUnitAmount = schema.number().int().min(0).max(100_000_000_000);
const stock = schema.number().int().min(0).max(1_000_000);

export const VariantBodySchema = schema.object({
  size: schema.string().max(40).optional(),
  color: schema.string().max(40).optional(),
  price: minorUnitAmount.optional(),
  stock,
  sku: schema.string().max(64).optional(),
});

export const CreateProductBodySchema = schema.object({
  title: schema.string().min(2).max(160),
  description: schema.string().max(5000).optional(),
  categoryId: schema.string().uuid().optional(),
  price: minorUnitAmount,
  compareAtPrice: minorUnitAmount.optional(),
  images: schema.array(schema.string().url().max(2048)).max(12).optional(),
  shippingInfo: schema.string().max(2000).optional(),
  returnsInfo: schema.string().max(2000).optional(),
  stock: stock.optional(),
  variants: schema.array(VariantBodySchema).min(1).max(50).optional(),
});

export const UpdateProductBodySchema = schema.object({
  title: schema.string().min(2).max(160).optional(),
  description: schema.string().max(5000).optional(),
  categoryId: schema.optional(schema.nullable(schema.string().uuid())),
  price: minorUnitAmount.optional(),
  compareAtPrice: schema.optional(schema.nullable(minorUnitAmount)),
  images: schema.array(schema.string().url().max(2048)).max(12).optional(),
  shippingInfo: schema.string().max(2000).optional(),
  returnsInfo: schema.string().max(2000).optional(),
});

export const UpdateVariantBodySchema = schema.object({
  size: schema.optional(schema.nullable(schema.string().max(40))),
  color: schema.optional(schema.nullable(schema.string().max(40))),
  price: minorUnitAmount.optional(),
  sku: schema.optional(schema.nullable(schema.string().max(64))),
});

export const AdjustInventoryBodySchema = schema.object({ delta: schema.number().int().min(-1_000_000).max(1_000_000) });

export const ProductParamsSchema = schema.object({ id: schema.string().uuid() });
export const StoreParamsSchema = schema.object({ storeId: schema.string().uuid() });
export const StoreProductParamsSchema = schema.object({ storeId: schema.string().uuid(), productId: schema.string().uuid() });
export const StoreVariantParamsSchema = schema.object({
  storeId: schema.string().uuid(),
  productId: schema.string().uuid(),
  variantId: schema.string().uuid(),
});

export const ListProductsQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
  categoryId: schema.string().uuid().optional(),
  categorySlug: schema.string().max(80).optional(),
  storeId: schema.string().uuid().optional(),
  q: schema.string().min(1).max(100).optional(),
  sort: schema.enum(["newest", "price_asc", "price_desc", "popular"]).optional(),
  minPrice: schema.coerce.number().int().min(0).optional(),
  maxPrice: schema.coerce.number().int().min(0).optional(),
  collection: schema.enum(["sales_of_the_day", "featured_brands", "new_arrivals"]).optional(),
});

export const SellerProductParamsSchema = schema.object({ id: schema.string().uuid() });
export const SellerVariantParamsSchema = schema.object({ id: schema.string().uuid(), variantId: schema.string().uuid() });
export const SellerScopeQuerySchema = schema.object({ storeId: schema.string().uuid().optional() });

export const SellerProductPageQuerySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const StorePageQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type VariantBody = Infer<typeof VariantBodySchema>;
export type CreateProductBody = Infer<typeof CreateProductBodySchema>;
export type UpdateProductBody = Infer<typeof UpdateProductBodySchema>;
export type UpdateVariantBody = Infer<typeof UpdateVariantBodySchema>;
export type ListProductsQueryInput = Infer<typeof ListProductsQuerySchema>;
