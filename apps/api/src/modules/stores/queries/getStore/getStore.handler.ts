import { QueryHandler } from "@zudojs/cqrs";

import type { StoreRecord } from "../../models/stores.model.js";
import type { StoresService } from "../../services/stores.service.js";
import type { GetStoreQuery } from "./getStore.query.js";

export interface StoreWithProductCount {
  readonly store: StoreRecord;
  readonly productCount: number;
}

export class GetStoreHandler extends QueryHandler<GetStoreQuery, StoreWithProductCount> {
  public readonly queryType = "stores.getStore" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(query: GetStoreQuery): Promise<StoreWithProductCount> {
    const store = await this.storesService.findPubliclyVisibleStoreOrThrow(query.lookup);
    return { store, productCount: await this.storesService.dependencies.countPublishedProductsForStore(store.id) };
  }
}
