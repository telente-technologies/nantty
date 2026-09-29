import { QueryHandler } from "@zudojs/cqrs";

import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ListMyStoresQuery } from "./listMyStores.query.js";

export class ListMyStoresHandler extends QueryHandler<ListMyStoresQuery, readonly StoreRecord[]> {
  public readonly queryType = "stores.listMyStores" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(query: ListMyStoresQuery): Promise<readonly StoreRecord[]> {
    const { stores } = this.storesService.dependencies;
    return stores.findManyByIds(await stores.listStoreIdsForMember(query.principal.userId));
  }
}
