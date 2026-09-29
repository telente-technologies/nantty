import { QueryHandler } from "@zudojs/cqrs";

import type { DisplayCart } from "../../services/carts.service.js";
import type { CartsService } from "../../services/carts.service.js";
import type { GetCartQuery } from "./getCart.query.js";

export class GetCartHandler extends QueryHandler<GetCartQuery, DisplayCart> {
  public readonly queryType = "carts.getCart" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(query: GetCartQuery): Promise<DisplayCart> {
    return this.service.buildDisplayCartForUser(query.principal.userId, query.displayCurrency);
  }
}
