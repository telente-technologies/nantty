import { Query } from "@zudojs/cqrs";

import type { ProductDiscoveryViewer } from "../../../products/services/productDiscovery.service.js";

export class SearchProductsQuery extends Query<"search.searchProducts"> {
  public constructor(
    public readonly term: string,
    public readonly limit: number,
    public readonly viewer: ProductDiscoveryViewer = { viewerId: undefined, country: null },
  ) {
    super("search.searchProducts");
  }
}
