import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListBrandDealsQuery extends Query<"creators.listBrandDeals"> {
  public constructor(
    public readonly creatorId: string,
    public readonly page: PageRequest,
  ) {
    super("creators.listBrandDeals");
  }
}
