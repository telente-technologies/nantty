import { QueryHandler } from "@zudojs/cqrs";

import { convertStoreToSummary } from "../../../stores/dtos/stores.dto.js";
import { convertProductToCardDto, convertStoreSummaryToShopDto, type MartHomeDto } from "../../dtos/products.dto.js";
import { calculateDiscountFraction } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { GetMartHomeQuery } from "./getMartHome.query.js";

const SECTION_SIZE = 10;
const DISCOUNT_CANDIDATES = 100;
const BANNER_COUNT = 5;

export class GetMartHomeHandler extends QueryHandler<GetMartHomeQuery, MartHomeDto> {
  public readonly queryType = "products.getMartHome" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: GetMartHomeQuery): Promise<MartHomeDto> {
    const { products, stores, categories, currencyConverter } = this.productsService.dependencies;
    const convert = await currencyConverter.prepareConversionInto(query.displayCurrency);
    const hiddenStoreIds = await this.productsService.listHiddenStoreIds();
    const discounted = (await products.listDiscountedPublished(hiddenStoreIds, DISCOUNT_CANDIDATES))
      .map((product) => ({ product, discount: calculateDiscountFraction(product) }))
      .filter((entry) => entry.discount > 0)
      .sort((left, right) => right.discount - left.discount)
      .slice(0, SECTION_SIZE);
    const featuredStores = await stores.list({ featured: true }, { limit: SECTION_SIZE });
    const newest = await products.listPublished({ sort: "newest", excludedStoreIds: hiddenStoreIds }, { limit: SECTION_SIZE });
    const bannerStores = featuredStores.data.filter((store) => (store.bannerUrl ?? store.logoUrl) !== null);
    const banners = [
      ...bannerStores.map((store) => ({ id: store.id, imageUrl: store.bannerUrl ?? store.logoUrl ?? "", target: { type: "store" as const, id: store.id } })),
      ...discounted.flatMap((entry) => (entry.product.images[0] === undefined ? [] : [{ id: entry.product.id, imageUrl: entry.product.images[0], target: { type: "product" as const, id: entry.product.id } }])),
    ].slice(0, BANNER_COUNT);
    return {
      currency: query.displayCurrency,
      banners,
      salesOfTheDayImageUrl: discounted.find((entry) => entry.product.images[0] !== undefined)?.product.images[0] ?? null,
      featuredBrandsImageUrl: bannerStores[0]?.bannerUrl ?? bannerStores[0]?.logoUrl ?? null,
      newArrivalsImageUrl: newest.data.find((product) => product.images[0] !== undefined)?.images[0] ?? null,
      categories: (await categories.listAll()).map((category) => ({ id: category.id, name: category.name, slug: category.slug, imageUrl: category.imageUrl })),
      salesOfTheDay: discounted.map((entry) => ({ ...convertProductToCardDto(entry.product, convert), discountPercent: Math.round(entry.discount * 100) })),
      featuredBrands: featuredStores.data.map((store) => convertStoreSummaryToShopDto(convertStoreToSummary(store), convert)),
      newArrivals: newest.data.map((item) => convertProductToCardDto(item, convert)),
    };
  }
}
