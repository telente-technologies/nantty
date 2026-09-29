import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { ProductDiscoveryViewer } from "../../services/productDiscovery.service.js";

export class GetMartHomeQuery extends Query<"products.getMartHome"> {
  public constructor(
    public readonly displayCurrency: CurrencyCode,
    public readonly viewer: ProductDiscoveryViewer = { viewerId: undefined, country: null },
  ) {
    super("products.getMartHome");
  }
}
