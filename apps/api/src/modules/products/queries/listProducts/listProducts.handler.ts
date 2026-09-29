import { QueryHandler } from "@zudojs/cqrs";

import { SUPPORTED_CURRENCY_CODES } from "../../../../enums/currency.enum.js";
import type { Page } from "../../../../types/pagination.type.js";
import { Money } from "../../../../utils/money.util.js";
import type { PriceRange, ProductRecord } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { ListProductsQuery } from "./listProducts.query.js";

export class ListProductsHandler extends QueryHandler<ListProductsQuery, Page<ProductRecord>> {
  public readonly queryType = "products.listProducts" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: ListProductsQuery): Promise<Page<ProductRecord>> {
    const { products, categories } = this.productsService.dependencies;
    const { categorySlug, categoryId, storeId, q, minPrice, maxPrice, sort } = query.filter;
    let resolvedCategoryId = categoryId;
    if (resolvedCategoryId === undefined && categorySlug !== undefined) {
      const category = await categories.findBySlug(categorySlug);
      if (category === undefined) return { items: [], nextCursor: null };
      resolvedCategoryId = category.id;
    }
    return products.listPublished(
      {
        sort: sort ?? "newest",
        excludedStoreIds: await this.productsService.listHiddenStoreIds(),
        ...(resolvedCategoryId === undefined ? {} : { categoryId: resolvedCategoryId }),
        ...(storeId === undefined ? {} : { storeId }),
        ...(q === undefined ? {} : { search: q.trim() }),
        ...(minPrice === undefined && maxPrice === undefined ? {} : { priceRanges: await this.convertPriceBoundsIntoEveryCurrency(query, minPrice, maxPrice) }),
      },
      query.page,
    );
  }

  private async convertPriceBoundsIntoEveryCurrency(
    query: ListProductsQuery,
    minPrice: number | undefined,
    maxPrice: number | undefined,
  ): Promise<readonly PriceRange[]> {
    const { currencyConverter } = this.productsService.dependencies;
    return Promise.all(SUPPORTED_CURRENCY_CODES.map(async (currency): Promise<PriceRange> => {
      const convert = await currencyConverter.prepareConversionInto(currency);
      const convertBound = (amount: number) => convert(Money.of(amount, query.displayCurrency)).amountMinor;
      return {
        currency,
        ...(minPrice === undefined ? {} : { minPrice: convertBound(minPrice) }),
        ...(maxPrice === undefined ? {} : { maxPrice: convertBound(maxPrice) }),
      };
    }));
  }
}
