import { QueryHandler } from "@zudojs/cqrs";

import type { StoreRecord } from "../../../stores/models/stores.model.js";
import type { SearchService } from "../../services/search.service.js";
import type { SearchStoresQuery } from "./searchStores.query.js";

export class SearchStoresHandler extends QueryHandler<SearchStoresQuery, readonly StoreRecord[]> {
  public readonly queryType = "search.searchStores" as const;

  public constructor(private readonly searchService: SearchService) {
    super();
  }

  public execute(query: SearchStoresQuery): Promise<readonly StoreRecord[]> {
    return this.searchService.productsService.dependencies.stores.searchByName(query.term, query.limit);
  }
}
