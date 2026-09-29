import { QueryHandler } from "@zudojs/cqrs";

import { convertStoreToSummary } from "../../../stores/dtos/stores.dto.js";
import { convertProductToCardDto, convertStoreSummaryToShopDto, type MartHomeDto } from "../../dtos/products.dto.js";
import { calculateDiscountFraction } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { GetMartHomeQuery } from "./getMartHome.query.js";

const SECTION_SIZE = 10;
const DISCOUNT_CANDIDATES = 100;

export class GetMartHomeHandler extends QueryHandler<GetMartHomeQuery, MartHomeDto> {
  public readonly queryType = "products.getMartHome" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: GetMartHomeQuery): Promise<MartHomeDto> {
    const { products, stores, currencyConverter } = this.productsService.dependencies;
    const convert = await currencyConverter.prepareConversionInto(query.displayCurrency);
    const hiddenStoreIds = await this.productsService.listHiddenStoreIds();
    const discounted = (await products.listDiscountedPublished(hiddenStoreIds, DISCOUNT_CANDIDATES))
      .map((product) => ({ product, discount: calculateDiscountFraction(product) }))
      .filter((entry) => entry.discount > 0)
      .sort((left, right) => right.discount - left.discount)
      .slice(0, SECTION_SIZE);
    const featuredStores = await stores.list({ featured: true }, { limit: SECTION_SIZE });
    const newest = await products.listPublished({ sort: "newest", excludedStoreIds: hiddenStoreIds }, { limit: SECTION_SIZE });
    return {
      currency: query.displayCurrency,
      salesOfTheDay: discounted.map((entry) => ({ ...convertProductToCardDto(entry.product, convert), discountPercent: Math.round(entry.discount * 100) })),
      featuredBrands: featuredStores.items.map((store) => convertStoreSummaryToShopDto(convertStoreToSummary(store), convert)),
      newArrivals: newest.items.map((item) => convertProductToCardDto(item, convert)),
    };
  }
}
