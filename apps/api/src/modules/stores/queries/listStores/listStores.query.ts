import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListStoresQuery extends Query<"stores.listStores"> {
  public constructor(
    public readonly featured: boolean | undefined,
    public readonly page: PageRequest,
  ) {
    super("stores.listStores");
  }
}
