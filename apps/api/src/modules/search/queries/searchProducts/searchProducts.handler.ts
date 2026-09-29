import { QueryHandler } from "@zudojs/cqrs";

import type { SponsorableProduct } from "../../../products/dtos/products.dto.js";
import { attachSponsoredProducts, rerankSearchResults } from "../../../products/services/productDiscovery.service.js";
import type { SearchService } from "../../services/search.service.js";
import type { SearchProductsQuery } from "./searchProducts.query.js";

export class SearchProductsHandler extends QueryHandler<SearchProductsQuery, readonly SponsorableProduct[]> {
  public readonly queryType = "search.searchProducts" as const;

  public constructor(private readonly searchService: SearchService) {
    super();
  }

  public async execute(query: SearchProductsQuery): Promise<readonly SponsorableProduct[]> {
    const { productsService } = this.searchService;
    const { products, discovery } = productsService.dependencies;
    const hiddenStoreIds = await productsService.listHiddenStoreIds();
    const page = await products.listPublished({ search: query.term, sort: "popular", excludedStoreIds: hiddenStoreIds }, { limit: query.limit });
    const now = new Date();
    const ranked = await rerankSearchResults(discovery, page.data, query.viewer, now);
    if (discovery !== undefined && query.viewer.viewerId !== undefined && query.term !== "") {
      await discovery.eventSink.record({
        eventType: "searched",
        actorUserId: query.viewer.viewerId,
        occurredAt: now,
        country: query.viewer.country,
        context: { surface: "search" },
        payload: { queryText: query.term, resultCount: ranked.length },
      });
    }
    return attachSponsoredProducts(discovery, products, ranked, "search", query.viewer, hiddenStoreIds);
  }
}
