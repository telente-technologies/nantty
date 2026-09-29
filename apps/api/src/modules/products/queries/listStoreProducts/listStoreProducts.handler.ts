import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { keepNativeCurrency } from "../../dtos/price.dto.js";
import { convertProductToDetailDto, type ProductDetailDto } from "../../dtos/products.dto.js";
import type { ProductsService } from "../../services/products.service.js";
import type { ListStoreProductsQuery } from "./listStoreProducts.query.js";

export class ListStoreProductsHandler extends QueryHandler<ListStoreProductsQuery, Page<ProductDetailDto>> {
  public readonly queryType = "products.listStoreProducts" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: ListStoreProductsQuery): Promise<Page<ProductDetailDto>> {
    const { products, variants, storeAccess } = this.productsService.dependencies;
    await storeAccess.assertStoreMember(query.principal.userId, query.storeId);
    const page = await products.listForStore(query.storeId, query.page);
    const allVariants = await variants.listForProducts(page.data.map((product) => product.id));
    return {
      data: page.data.map((product) => convertProductToDetailDto(product, allVariants.filter((variant) => variant.productId === product.id), keepNativeCurrency)),
      nextCursor: page.nextCursor,
    };
  }
}
