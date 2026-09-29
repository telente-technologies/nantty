import { QueryHandler } from "@zudojs/cqrs";

import type { ProductRecord } from "../../../products/models/products.model.js";
import type { SearchService } from "../../services/search.service.js";
import type { SearchProductsQuery } from "./searchProducts.query.js";

export class SearchProductsHandler extends QueryHandler<SearchProductsQuery, readonly ProductRecord[]> {
  public readonly queryType = "search.searchProducts" as const;

  public constructor(private readonly searchService: SearchService) {
    super();
  }

  public async execute(query: SearchProductsQuery): Promise<readonly ProductRecord[]> {
    const { productsService } = this.searchService;
    const page = await productsService.dependencies.products.listPublished(
      { search: query.term, sort: "popular", excludedStoreIds: await productsService.listHiddenStoreIds() },
      { limit: query.limit },
    );
    return page.data;
  }
}
