import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { ListProductsQueryInput } from "../../validators/products.validator.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListProductsQuery extends Query<"products.listProducts"> {
  public constructor(
    public readonly filter: ListProductsQueryInput,
    public readonly page: PageRequest,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("products.listProducts");
  }
}
