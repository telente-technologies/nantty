import { QueryHandler } from "@zudojs/cqrs";

import type { ProductWithVariants } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { GetStoreProductQuery } from "./getStoreProduct.query.js";

export class GetStoreProductHandler extends QueryHandler<GetStoreProductQuery, ProductWithVariants> {
  public readonly queryType = "products.getStoreProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: GetStoreProductQuery): Promise<ProductWithVariants> {
    const product = await this.productsService.findStoreProductForMember(query.principal.userId, query.storeId, query.productId);
    return this.productsService.loadProductWithVariants(product);
  }
}
