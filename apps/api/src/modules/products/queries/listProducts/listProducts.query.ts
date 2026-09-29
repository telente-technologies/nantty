import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { ListProductsQueryInput } from "../../validators/products.validator.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { ProductDiscoveryViewer } from "../../services/productDiscovery.service.js";

export class ListProductsQuery extends Query<"products.listProducts"> {
  public constructor(
    public readonly filter: ListProductsQueryInput,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
    public readonly viewer: ProductDiscoveryViewer = { viewerId: undefined, country: null },
  ) {
    super("products.listProducts");
  }
}
