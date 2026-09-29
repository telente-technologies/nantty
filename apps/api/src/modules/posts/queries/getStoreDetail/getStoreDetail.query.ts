import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetStoreDetailQuery extends Query<"posts.getStoreDetail"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly storeId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.getStoreDetail");
  }
}
