import { SocialError, unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { TaggedProductView } from "../models/post.model.js";
import type { PostRow } from "../repositories/post.repository.js";

export async function assertProductsTaggable(context: HandlerContext, productIds: readonly string[]): Promise<string[]> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return [];
  if (context.products === undefined) throw new SocialError(503, "PRODUCTS_UNAVAILABLE", "Product tagging is temporarily unavailable.");
  const found = await context.products.findProducts(unique);
  const rejected = unique.filter((productId) => found.get(productId)?.taggable !== true);
  if (rejected.length > 0) throw unprocessable("PRODUCT_NOT_TAGGABLE", "Only published products can be tagged.", { productIds: rejected });
  return unique;
}

export async function loadTaggedProducts(context: HandlerContext, rows: readonly PostRow[]): Promise<ReadonlyMap<string, readonly TaggedProductView[]>> {
  const productIds = [...new Set(rows.flatMap((row) => row.productIds))];
  if (productIds.length === 0 || context.products === undefined) return new Map();
  const found = await context.products.findProducts(productIds).catch(() => new Map());
  return new Map(rows.map((row) => [row.id, row.productIds.flatMap((productId) => {
    const product = found.get(productId);
    return product === undefined || !product.taggable ? [] : [{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, stock: product.stock }];
  })]));
}
