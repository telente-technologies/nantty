import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListStorePostsQuery extends Query<"posts.listStorePosts"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly storeId: string,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.listStorePosts");
  }
}
