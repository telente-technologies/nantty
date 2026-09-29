import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ListStoresQuery } from "./listStores.query.js";

export class ListStoresHandler extends QueryHandler<ListStoresQuery, Page<StoreRecord>> {
  public readonly queryType = "stores.listStores" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public execute(query: ListStoresQuery): Promise<Page<StoreRecord>> {
    return this.storesService.dependencies.stores.list(query.featured === undefined ? {} : { featured: query.featured }, query.page);
  }
}
