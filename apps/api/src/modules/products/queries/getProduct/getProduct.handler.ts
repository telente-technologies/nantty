import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertStoreToSummary } from "../../../stores/dtos/stores.dto.js";
import {
  convertProductToCardDto,
  convertProductToDetailDto,
  convertStoreSummaryToShopDto,
  type PublicProductDetailDto,
} from "../../dtos/products.dto.js";
import type { ProductsService } from "../../services/products.service.js";
import type { GetProductQuery } from "./getProduct.query.js";

const FEATURED_WITH_LIMIT = 8;

export class GetProductHandler extends QueryHandler<GetProductQuery, PublicProductDetailDto> {
  public readonly queryType = "products.getProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: GetProductQuery): Promise<PublicProductDetailDto> {
    const { products, variants, stores, currencyConverter } = this.productsService.dependencies;
    const convert = await currencyConverter.prepareConversionInto(query.displayCurrency);
    const product = await this.productsService.findPubliclyVisibleProductOrThrow(query.productId);
    const store = await stores.findById(product.storeId);
    if (store === undefined) throw notFound("Product");
    const related = await products.listRelatedPublished(product, await this.productsService.listHiddenStoreIds(), FEATURED_WITH_LIMIT);
    return {
      ...convertProductToDetailDto(product, await variants.listForProducts([product.id]), convert),
      shop: convertStoreSummaryToShopDto(convertStoreToSummary(store), convert),
      featuredWith: related.map((item) => convertProductToCardDto(item, convert)),
    };
  }
}
