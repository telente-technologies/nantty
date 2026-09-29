import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListStoreProductsQuery extends Query<"products.listStoreProducts"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly page: PageRequest,
  ) {
    super("products.listStoreProducts");
  }
}
