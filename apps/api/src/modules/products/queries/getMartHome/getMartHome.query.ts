import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetMartHomeQuery extends Query<"products.getMartHome"> {
  public constructor(public readonly displayCurrency: CurrencyCode) {
    super("products.getMartHome");
  }
}
