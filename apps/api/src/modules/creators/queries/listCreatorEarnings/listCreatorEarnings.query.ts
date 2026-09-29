import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListCreatorEarningsQuery extends Query<"creators.listCreatorEarnings"> {
  public constructor(
    public readonly userId: string,
    public readonly page: PageRequest,
  ) {
    super("creators.listCreatorEarnings");
  }
}
