import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { resolveSellerStoreIdForUser } from "../../../../utils/sellerStore.util.js";
import type { ProductsService } from "../../services/products.service.js";
import type { ResolveSellerStoreQuery } from "./resolveSellerStore.query.js";

export class ResolveSellerStoreHandler extends QueryHandler<ResolveSellerStoreQuery, string> {
  public readonly queryType = "products.resolveSellerStore" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: ResolveSellerStoreQuery): Promise<string> {
    const { products, storeAccess } = this.productsService.dependencies;
    if (query.productId === undefined) return resolveSellerStoreIdForUser(storeAccess, query.principal.userId, query.requestedStoreId);
    const product = await products.findById(query.productId);
    if (product === undefined || product.status === "archived") throw notFound("Product");
    await storeAccess.assertStoreMember(query.principal.userId, product.storeId);
    return product.storeId;
  }
}
