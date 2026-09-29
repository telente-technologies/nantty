import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetProductQuery extends Query<"products.getProduct"> {
  public constructor(
    public readonly productId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("products.getProduct");
  }
}
