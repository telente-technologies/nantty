import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class ListGiftCatalogQuery extends Query<"creators.listGiftCatalog"> {
  public constructor(
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("creators.listGiftCatalog");
  }
}
