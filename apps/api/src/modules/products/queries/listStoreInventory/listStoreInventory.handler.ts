import { QueryHandler } from "@zudojs/cqrs";

import type { InventoryLine } from "../../../../interfaces/productCatalog.interface.js";
import type { ProductsService } from "../../services/products.service.js";
import type { ListStoreInventoryQuery } from "./listStoreInventory.query.js";

export class ListStoreInventoryHandler extends QueryHandler<ListStoreInventoryQuery, readonly InventoryLine[]> {
  public readonly queryType = "products.listStoreInventory" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: ListStoreInventoryQuery): Promise<readonly InventoryLine[]> {
    await this.productsService.dependencies.storeAccess.assertStoreMember(query.principal.userId, query.storeId);
    return this.productsService.buildInventoryLinesForStore(query.storeId);
  }
}
